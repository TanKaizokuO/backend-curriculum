/**
 * Lesson 8 in TypeScript — the same API, with accounts.
 *
 *     POST /auth/login   -> a session cookie. The server holds the state.
 *     POST /auth/token   -> a JWT. The client holds the state.
 *     (nothing)          -> anonymous. You may read; you may not write.
 *
 * Run it:
 *
 *     node src/migrate.ts
 *     node src/server.ts
 *
 * Every route matches `Code/Lesson_8_code/main.py`, status code for status
 * code. Two differences are real, and the lesson names both:
 *
 *   1. FastAPI validates from the type annotation. Express validates nothing,
 *      so zod does that work in each handler.
 *   2. FastAPI has a dependency; Express has middleware. The same idea
 *      arrives at a different place in the file.
 */

import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

import { config } from './config.ts';
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

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const app = express();
app.use(express.json());
app.use(cookieParser());

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

// --------------------------------------------------------------------------
// Who is asking?
// --------------------------------------------------------------------------

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
      const { rows } = await pool.query<User>(SESSION_SQL, [sessionId]);
      if (rows[0]) {
        req.user = rows[0];
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

// --------------------------------------------------------------------------
// Accounts
// --------------------------------------------------------------------------

app.post('/auth/register', route(async (req, res) => {
  const parsed = Credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ detail: z.treeifyError(parsed.error) });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (email, password_hash)
       VALUES (lower($1), $2)
       RETURNING id, email`,
      [parsed.data.email, passwordHash],
    );
    res.status(201).json(rows[0]);
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
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, password_hash FROM users WHERE email = lower($1)',
    [email],
  );
  const row = rows[0];
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
  await pool.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [
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
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, password_hash FROM users WHERE email = lower($1)',
    [parsed.data.email],
  );
  const row = rows[0];
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
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, password_hash FROM users WHERE email = lower($1)',
    [parsed.data.email],
  );
  const row = rows[0];
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
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' }).status(204).end();
}));

app.post('/auth/logout-everywhere', requireUser, route(async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.user!.id]);
  res.status(204).end();
}));

// --------------------------------------------------------------------------
// The API from Lessons 4 to 7, now with an owner
// --------------------------------------------------------------------------

app.get('/healthz', route(async (_req, res) => {
  try {
    await pool.query('SELECT 1');
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
  const { rows } = await pool.query(LIST_SQL, [limit, skip]);
  res.json(rows);
}));

app.post('/bookmarks', requireUser, route(async (req, res) => {
  const parsed = BookmarkCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ detail: z.treeifyError(parsed.error) });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO bookmarks (url, title, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, url, title, visit_count, user_id`,
      [parsed.data.url, parsed.data.title ?? null, req.user!.id],
    );
    for (const name of parsed.data.tags) {
      await client.query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
      await client.query(
        `INSERT INTO bookmark_tags (bookmark_id, tag_id)
         SELECT $1, id FROM tags WHERE name = $2
         ON CONFLICT DO NOTHING`,
        [rows[0].id, name],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], tags: parsed.data.tags });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof Error && 'code' in error && error.code === UNIQUE_VIOLATION) {
      res.status(409).json({ detail: 'url already exists' });
      return;
    }
    throw error;
  } finally {
    client.release();
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
  const { rows } = await pool.query<{ user_id: number | null }>(
    'SELECT user_id FROM bookmarks WHERE id = $1',
    [id],
  );
  if (!rows[0]) {
    res.status(404).json({ detail: 'Bookmark not found' });
    return;
  }
  if (rows[0].user_id !== req.user!.id) {
    res.status(403).json({ detail: 'not your bookmark' });
    return;
  }
  await pool.query('DELETE FROM bookmarks WHERE id = $1', [id]);
  res.status(204).end();
}));

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ detail: 'internal error' });
});

export { app, pool };
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`bookmarks api listening on http://0.0.0.0:${config.port}`);
  });
}
