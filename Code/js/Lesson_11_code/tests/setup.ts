import { afterEach, beforeAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import type { Express } from 'express';

import { config } from '../src/config.ts';
import { createApp } from '../src/app.ts';
import { Db } from '../src/db.ts';
import type { Connection, ConnectionSource } from '../src/db.ts';
import { DictCache } from '../src/cache.ts';

/** The test app, rebuilt fresh before every test. A live `export let`
 * binding: a test file imports `app` once, and each `beforeEach` below
 * assigns a new value that the import sees through ESM's live binding. */
export let app: Express;

beforeAll(async () => {
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.end();

  // `migrate.ts` runs its migration as a top-level await on import, and it
  // must run after the DROP/CREATE SCHEMA above, so a static (hoisted)
  // import cannot be used here — the import must happen at this point in
  // the sequence, not at module-load time.
  await import('../src/migrate.ts');
});

/**
 * A connection source for `Db`, in place of the `pg` `Pool`.
 *
 * Production passes the `Pool` itself, whose `connect()` hands out a fresh
 * connection for each checkout. This class passes one shared connection and
 * opens a SAVEPOINT for each checkout instead. `beforeEach` opens the outer
 * transaction first, so each savepoint nests and commits nothing for real.
 * A route's own rollback (on a duplicate URL, say) undoes only its own
 * savepoint. `afterEach` rolls back the outer transaction, so no write
 * reaches another test.
 *
 * `Db` runs the same code for both sources, so a test exercises the same
 * span code that the application runs — no monkey-patching of `pool.query`
 * or `pool.connect` needed.
 */
class SavepointSource implements ConnectionSource {
  private readonly conn: Client;
  private depth = 0;

  constructor(conn: Client) {
    this.conn = conn;
  }

  async connect(): Promise<Connection & { release(): void }> {
    this.depth += 1;
    const name = `test_checkout_${this.depth}`;
    const conn = this.conn;
    return {
      query: <T extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        params?: unknown[],
      ) => {
        if (text === 'BEGIN') return conn.query<T>(`SAVEPOINT ${name}`);
        if (text === 'COMMIT') return conn.query<T>(`RELEASE SAVEPOINT ${name}`);
        if (text === 'ROLLBACK') return conn.query<T>(`ROLLBACK TO SAVEPOINT ${name}`);
        return conn.query<T>(text, params);
      },
      release: () => {},
    };
  }
}

let conn: Client;

beforeEach(async () => {
  conn = new Client({ connectionString: config.databaseUrl });
  await conn.connect();
  await conn.query('BEGIN');
  app = createApp({ db: new Db(new SavepointSource(conn)), cache: new DictCache() });
});

afterEach(async () => {
  // Roll back the outer transaction instead of committing it, so every
  // write this test made — across every checkout above — disappears.
  await conn.query('ROLLBACK');
  await conn.end();
});
