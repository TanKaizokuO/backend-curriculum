import { afterEach, beforeAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import { config } from '../src/config.ts';
import { pool } from '../src/server.ts';

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

// The real `pool` hands each request its own connection. For tests, every
// request in one test shares a single connection wrapped in one open
// transaction, and `afterEach` rolls it back — so a test can never leak a
// row into the next one.
const originalQuery = pool.query.bind(pool);
const originalConnect = pool.connect.bind(pool);

let conn: Client;
let savepointDepth: number;

beforeEach(async () => {
  conn = new Client({ connectionString: config.databaseUrl });
  await conn.connect();
  await conn.query('BEGIN');
  savepointDepth = 0;

  // `pool.query(...)` is used directly by most routes (register, requireUser,
  // delete bookmark). Route it straight through the one open connection.
  pool.query = ((...args: Parameters<typeof originalQuery>) =>
    conn.query(...(args as Parameters<typeof conn.query>))) as typeof pool.query;

  // `pool.connect()` is used by the create-bookmark route, which issues its
  // own BEGIN/COMMIT/ROLLBACK. Translate those into a SAVEPOINT nested
  // inside the outer transaction, so the route's own rollback (on a
  // duplicate URL, say) undoes only its own work, not the whole test.
  pool.connect = (async () => {
    savepointDepth += 1;
    const name = `test_checkout_${savepointDepth}`;
    return {
      query: async (text: unknown, params?: unknown[]) => {
        if (text === 'BEGIN') return conn.query(`SAVEPOINT ${name}`);
        if (text === 'COMMIT') return conn.query(`RELEASE SAVEPOINT ${name}`);
        if (text === 'ROLLBACK') return conn.query(`ROLLBACK TO SAVEPOINT ${name}`);
        return conn.query(text as string, params);
      },
      release: () => {},
    };
  }) as typeof pool.connect;
});

afterEach(async () => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
  await conn.query('ROLLBACK');
  await conn.end();
});
