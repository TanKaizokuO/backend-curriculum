/**
 * Lesson 11 in TypeScript — the same API, observed: structured logs,
 * metrics, a trace.
 *
 *     POST /auth/login      -> a session cookie. The server holds the state.
 *     POST /auth/token      -> a JWT. The client holds the state.
 *     GET  /metrics         -> a counter and a histogram, in Prometheus's
 *                              text format.
 *     (nothing)             -> anonymous. You may read; you may not write.
 *
 * Every request now writes one JSON log line, updates two metrics, and
 * opens one trace span with a child span for every database round trip.
 * `observability.ts` holds the wiring; `db.ts` and `cache.ts` hold the two
 * seams; this file only calls them.
 *
 * `createApp({ db, cache })` builds the routes and returns the Express
 * app. It opens no connection of its own and imports nothing that does —
 * a route reaches the database and the cache only through the `db` and
 * `cache` it was given. `server.ts` builds the production `db` and `cache`
 * and calls this function once. `tests/setup.ts` builds a `db` over a
 * connection that opens a SAVEPOINT per checkout, and a `DictCache` with no
 * server at all, and calls this function fresh before every test. Both
 * builds run the exact same routes.
 */

import { createHash, randomUUID } from 'node:crypto';

import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { context, trace } from '@opentelemetry/api';
import { z } from 'zod';

import type { Db } from './db.ts';
import type { SearchCache } from './cache.ts';
import { config } from './config.ts';
import { logEvent, registry, requestCount, requestIdStorage, requestLatency, tracer } from './observability.ts';
import {
  TokenError,
  hashPassword,
  issueToken,
  newSessionId,
  verifyPassword,
  verifyToken,
  wasteTimeLikeARealLogin,
} from './security.ts';

const SESSION_COOKIE = 'session';
const UNIQUE_VIOLATION = '23505';

interface User {
  id: number;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

export interface AppDependencies {
  db: Db;
  cache: SearchCache;
}

/** Build the Express app. Called once, in production; called fresh in
 * every test, with a `db` and a `cache` wired to the test's own resources.
 */
export function createApp({ db, cache }: AppDependencies): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  /**
   * One span, one metric update, one log line, for every request.
   *
   * The route template is not known until Express finishes matching, so it
   * is read from `req.route` inside the handler that runs after matching,
   * via `res.on('finish', ...)` — the same reason the Python middleware
   * reads `request.scope["route"]` only after `call_next`. Grouping
   * `/bookmarks/17` and `/bookmarks/42` under `/bookmarks/:id` keeps the
   * metric's cardinality bounded — one time series per route, not one per
   * id ever requested.
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID().replaceAll('-', '').slice(0, 16);
    requestIdStorage.run(requestId, () => {
      const start = performance.now();
      const span = tracer.startSpan('http_request');
      span.setAttribute('http.method', req.method);
      res.setHeader('X-Request-Id', requestId);
      res.on('finish', () => {
        const durationS = (performance.now() - start) / 1000;
        const routePath = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
        span.setAttribute('http.route', routePath);
        span.setAttribute('http.status_code', res.statusCode);
        span.end();
        requestCount.labels(req.method, routePath, String(res.statusCode)).inc();
        requestLatency.labels(req.method, routePath).observe(durationS);
        logEvent({
          level: 'info',
          method: req.method,
          path: routePath,
          status: res.statusCode,
          duration_ms: Math.round(durationS * 1000 * 100) / 100,
        });
      });
      // Enter the span into the active context before calling `next()`, so
      // every async operation the route handler starts — including the
      // `pg_query` span that `db.ts` opens — inherits this span as its
      // parent. `startSpan()` alone creates a span but does not activate it.
      context.with(trace.setSpan(context.active(), span), () => next());
    });
  });

  app.get('/metrics', (_req: Request, res: Response) => {
    res.set('Content-Type', registry.contentType);
    registry.metrics().then((body) => res.send(body));
  });

  const Credentials = z.object({
    email: z.email().max(320),
    // bcrypt reads 72 bytes. Say so in the contract instead of truncating in
    // silence, because a silent truncation makes two different passwords equal.
    password: z.string().min(8).max(72),
  });

  const BookmarkCreate = z.object({
    url: z.string().min(1),
    title: z.string().nullish(),
    tags: z.array(z.string()).default([]),
  });

  /** Express 4 does not catch a rejected promise. This wrapper does. */
  function route(handler: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res).catch(next);
    };
  }

  // ------------------------------------------------------------------------
  // Who is asking?
  // ------------------------------------------------------------------------

  const SESSION_SQL = `
    SELECT u.id, u.email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.id = $1
       AND s.expires_at > now()
  `;

  /**
   * The twin of the FastAPI dependency. It answers 401 and stops the chain,
   * or it attaches the user and calls next().
   *
   * The cookie wins when a request carries both, because a browser attaches a
   * cookie on its own and a script attaches a header on purpose.
   */
  async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId: unknown = req.cookies[SESSION_COOKIE];
      if (typeof sessionId === 'string' && sessionId.length > 0) {
        const user = await db.fetchOne<User>(SESSION_SQL, [sessionId]);
        if (user) {
          req.user = user;
          next();
          return;
        }
      }

      const authorization = req.get('authorization');
      if (authorization?.startsWith('Bearer ')) {
        try {
          const claims = verifyToken(authorization.slice('Bearer '.length));
          req.user = { id: Number(claims.sub), email: claims.email };
          next();
          return;
        } catch (error) {
          const reason = error instanceof TokenError ? error.message : 'invalid';
          res.status(401).json({ detail: `bad token: ${reason}` });
          return;
        }
      }

      res.set('WWW-Authenticate', 'Bearer').status(401).json({ detail: 'not signed in' });
    } catch (error) {
      next(error);
    }
  }

  // ------------------------------------------------------------------------
  // Accounts
  // ------------------------------------------------------------------------

  app.post('/auth/register', route(async (req, res) => {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: z.treeifyError(parsed.error) });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    try {
      const user = await db.fetchOne<User>(
        `INSERT INTO users (email, password_hash)
         VALUES (lower($1), $2)
         RETURNING id, email`,
        [parsed.data.email, passwordHash],
      );
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === UNIQUE_VIOLATION) {
        res.status(409).json({ detail: 'email already registered' });
        return;
      }
      throw error;
    }
  }));

  interface UserRow extends User {
    password_hash: string;
  }

  /** Return the user row, or null. Cost the same either way. */
  async function authenticate(email: string, password: string): Promise<UserRow | null> {
    const row = await db.fetchOne<UserRow>(
      'SELECT id, email, password_hash FROM users WHERE email = lower($1)',
      [email],
    );
    if (!row) {
      // Spend the same time as a real check, then give the same answer.
      await wasteTimeLikeARealLogin();
      return null;
    }
    return (await verifyPassword(password, row.password_hash)) ? row : null;
  }

  app.post('/auth/login', route(async (req, res) => {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: z.treeifyError(parsed.error) });
      return;
    }

    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      res.status(401).json({ detail: 'wrong email or password' });
      return;
    }

    const sessionId = newSessionId();
    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
    await db.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [
      sessionId,
      user.id,
      expiresAt,
    ]);

    res.cookie(SESSION_COOKIE, sessionId, {
      maxAge: config.sessionTtlSeconds * 1000,
      httpOnly: true,               // JavaScript cannot read it
      sameSite: 'lax',              // it does not travel with a cross-site POST
      secure: config.cookieSecure,  // HTTPS only, outside development
      path: '/',
    });
    res.json({ id: user.id, email: user.email });
  }));

  /**
   * The same check, without the dummy hash. Measure it, then delete it.
   *
   * An unknown email returns after one SELECT. A known email pays for one
   * bcrypt verification. The clock tells a stranger which of your emails are
   * real, and the answer is a user list.
   */
  app.post('/auth/login-leaky', route(async (req, res) => {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: z.treeifyError(parsed.error) });
      return;
    }
    const row = await db.fetchOne<UserRow>(
      'SELECT id, email, password_hash FROM users WHERE email = lower($1)',
      [parsed.data.email],
    );
    if (!row || !(await verifyPassword(parsed.data.password, row.password_hash))) {
      res.status(401).json({ detail: 'wrong email or password' });
      return;
    }
    res.json({ id: row.id, email: row.email });
  }));

  /**
   * The same check, on the event loop. Measure it, then delete this route.
   *
   * bcrypt.compareSync needs about 190 ms of CPU, and Node runs one JavaScript
   * thread. Every other request waits. `src/eventLoopBlock.ts` measures it.
   */
  app.post('/auth/login-blocking', route(async (req, res) => {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: z.treeifyError(parsed.error) });
      return;
    }
    const row = await db.fetchOne<UserRow>(
      'SELECT id, email, password_hash FROM users WHERE email = lower($1)',
      [parsed.data.email],
    );
    if (!row || !bcrypt.compareSync(parsed.data.password, row.password_hash)) {
      res.status(401).json({ detail: 'wrong email or password' });
      return;
    }
    res.json({ id: row.id, email: row.email });
  }));

  app.post('/auth/token', route(async (req, res) => {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: z.treeifyError(parsed.error) });
      return;
    }
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      res.status(401).json({ detail: 'wrong email or password' });
      return;
    }
    res.json({
      access_token: issueToken(user.id, user.email),
      token_type: 'bearer',
      expires_in: config.tokenTtlSeconds,
    });
  }));

  app.get('/auth/me', requireUser, (req: Request, res: Response) => {
    res.json(req.user);
  });

  /**
   * Delete the session row, then clear the cookie.
   *
   * This is the difference that decides the whole lesson. One DELETE ends the
   * session everywhere, at once. There is no equivalent for a signed token.
   */
  app.post('/auth/logout', route(async (req, res) => {
    const sessionId: unknown = req.cookies[SESSION_COOKIE];
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      await db.execute('DELETE FROM sessions WHERE id = $1', [sessionId]);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' }).status(204).end();
  }));

  app.post('/auth/logout-everywhere', requireUser, route(async (req, res) => {
    await db.execute('DELETE FROM sessions WHERE user_id = $1', [req.user!.id]);
    res.status(204).end();
  }));

  // ------------------------------------------------------------------------
  // The API from Lessons 4 to 7, now with an owner
  // ------------------------------------------------------------------------

  app.get('/healthz', route(async (_req, res) => {
    try {
      await db.execute('SELECT 1');
    } catch (error) {
      res.status(503).json({ detail: `database: ${String(error)}` });
      return;
    }
    res.json({ status: 'ok', env: config.nodeEnv });
  }));

  const LIST_SQL = `
    SELECT b.id, b.url, b.title, b.visit_count, b.user_id,
           array_agg(t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      LEFT JOIN tags t           ON t.id = bt.tag_id
     GROUP BY b.id
     ORDER BY b.id
     LIMIT $1 OFFSET $2
  `;

  app.get('/bookmarks', route(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 10), 100);
    const skip = Number(req.query.skip ?? 0);
    const rows = await db.fetchAll(LIST_SQL, [limit, skip]);
    res.json(rows);
  }));

  const SEARCH_SQL = `
    SELECT id, url, title
      FROM bookmarks
     WHERE title LIKE $1
     ORDER BY id
     LIMIT $2 OFFSET $3
  `;

  /**
   * Public. Prefix search on the title, cached.
   *
   * Register this route before `/bookmarks/:id`. Express matches routes in
   * the order you add them, and "search" would otherwise match `:id` as a
   * literal string and reach the wrong handler.
   *
   * The database already answers this query fast: migration 0003 gives it an
   * index. The cache exists to remove the round trip and the CPU work for a
   * query the same client repeats, not to fix a slow query.
   *
   * `cache` is a `SearchCache`: `lookup` and `store`, nothing else.
   * Production wires a `RedisCache`. The test suite wires a `DictCache`, so
   * a cache test needs no running Redis server.
   *
   * A cache hit answers with no database span. A miss opens one `pg_query`
   * span. `db.ts` emits that span, so the count stays correct and this
   * function names no span.
   */
  app.get('/bookmarks/search', route(async (req, res) => {
    const q = String(req.query.q ?? '');
    const limit = Math.min(Number(req.query.limit ?? 10), 100);
    const skip = Number(req.query.skip ?? 0);

    const cached = await cache.lookup(q, skip, limit);
    if (cached !== null) {
      res.json({ source: 'cache', results: cached });
      return;
    }

    const rows = await db.fetchAll(SEARCH_SQL, [`${q}%`, limit, skip]);
    await cache.store(q, skip, limit, rows);
    res.json({ source: 'database', results: rows });
  }));

  /**
   * Public. One row, with an ETag.
   *
   * The ETag is a hash of the fields the client can see. Two requests for the
   * same row get the same ETag until a write changes `visit_count` or
   * `title`. A matching `If-None-Match` gets a 304 with no body.
   */
  app.get('/bookmarks/:id', route(async (req, res) => {
    const id = Number(req.params.id);
    const row = await db.fetchOne(
      'SELECT id, url, title, visit_count, user_id FROM bookmarks WHERE id = $1',
      [id],
    );
    if (!row) {
      res.status(404).json({ detail: 'bookmark not found' });
      return;
    }

    const etag = createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16);
    res.set('Cache-Control', 'max-age=30');
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.json(row);
  }));

  app.post('/bookmarks', requireUser, route(async (req, res) => {
    const parsed = BookmarkCreate.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: z.treeifyError(parsed.error) });
      return;
    }

    try {
      const bookmark = await db.tx(async (t) => {
        const row = await t.fetchOne<{ id: number; url: string; title: string | null; visit_count: number; user_id: number }>(
          `INSERT INTO bookmarks (url, title, user_id)
           VALUES ($1, $2, $3)
           RETURNING id, url, title, visit_count, user_id`,
          [parsed.data.url, parsed.data.title ?? null, req.user!.id],
        );
        for (const name of parsed.data.tags) {
          await t.execute('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
          await t.execute(
            `INSERT INTO bookmark_tags (bookmark_id, tag_id)
             SELECT $1, id FROM tags WHERE name = $2
             ON CONFLICT DO NOTHING`,
            [row!.id, name],
          );
        }
        return row!;
      });
      res.status(201).json({ ...bookmark, tags: parsed.data.tags });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === UNIQUE_VIOLATION) {
        res.status(409).json({ detail: 'url already exists' });
        return;
      }
      throw error;
    }
  }));

  /**
   * Signed in, and yours.
   *
   * 401 says "I do not know who you are". 403 says "I know, and the answer is
   * no". Two different questions: authentication, then authorisation.
   */
  app.delete('/bookmarks/:id', requireUser, route(async (req, res) => {
    const id = Number(req.params.id);
    const row = await db.fetchOne<{ user_id: number | null }>(
      'SELECT user_id FROM bookmarks WHERE id = $1',
      [id],
    );
    if (!row) {
      res.status(404).json({ detail: 'Bookmark not found' });
      return;
    }
    if (row.user_id !== req.user!.id) {
      res.status(403).json({ detail: 'not your bookmark' });
      return;
    }
    await db.execute('DELETE FROM bookmarks WHERE id = $1', [id]);
    res.status(204).end();
  }));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ detail: 'internal error' });
  });

  return app;
}
