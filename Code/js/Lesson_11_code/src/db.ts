/**
 * Lesson 11 in TypeScript — the twin of `Code/Lesson_11_code/db.py`.
 *
 *     db.fetchOne(sql, args)    -> one row, or undefined
 *     db.fetchAll(sql, args)    -> every row
 *     db.execute(sql, args)     -> no row; for INSERT, UPDATE, and DELETE
 *     db.tx(async (t) => {...}) -> several statements, one transaction
 *
 * WARNING: never put the query parameters on a span. The parameters here
 * hold an email address, a session id, and a password hash. This module
 * records the SQL text in `db.statement` and records no parameter. `pg`
 * sends the parameters on a separate channel, so the statement text is
 * safe to export.
 *
 * The server used to spread `pool.query()` across fourteen call sites, and
 * only one of them opened a `pg_query` span. This module keeps the
 * checkout, the span, and the metric in one place. A route passes SQL and
 * arguments. A route never sees a connection, and a route never names a
 * span. The span is not a rule that a route obeys. The span is the only
 * route to the database.
 */

import type { QueryResultRow } from 'pg';

import { dbQueryDuration, tracer } from './observability.ts';

/** What `Db` needs from a client: run a statement, return rows and a count. */
export interface Connection {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * What `Db` needs to obtain one. Production passes the `pg` `Pool`
 * directly — `Pool.connect()` already returns a client with `query` and
 * `release`. A test passes a source that opens a SAVEPOINT on one shared
 * connection instead. Both sources run the same `Db`, so a test exercises
 * the same span code that production runs.
 */
export interface ConnectionSource {
  connect(): Promise<Connection & { release(): void }>;
}

type Fetch = 'one' | 'all' | 'none';

/** Run one statement on one connection, inside one span.
 *
 * Every public method arrives here, so the span and the metric happen once
 * in the code and always at runtime.
 */
async function run<T extends QueryResultRow = QueryResultRow>(
  conn: Connection,
  sql: string,
  args: unknown[],
  fetch: Fetch,
): Promise<T | T[] | undefined> {
  return tracer.startActiveSpan('pg_query', async (span) => {
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.statement', sql.trim());
    const start = performance.now();
    const result = await conn.query<T>(sql, args);
    dbQueryDuration.observe((performance.now() - start) / 1000);

    if (fetch === 'one') {
      span.setAttribute('db.rows_returned', result.rows.length > 0 ? 1 : 0);
      span.end();
      return result.rows[0];
    }
    if (fetch === 'all') {
      span.setAttribute('db.rows_returned', result.rows.length);
      span.end();
      return result.rows;
    }
    span.setAttribute('db.rows_affected', result.rowCount ?? 0);
    span.end();
    return undefined;
  });
}

/** The seam between a route and Postgres.
 *
 * The application passes the `pg` `Pool`. The test suite passes a source
 * that opens a SAVEPOINT on one shared connection. Both sources run this
 * same class, so a test exercises the same span code that production runs.
 */
export class Db {
  private readonly source: ConnectionSource;

  constructor(source: ConnectionSource) {
    this.source = source;
  }

  /** Return the first row, or `undefined`. An absent row is a normal
   * answer: the caller maps it to 401 or to 404. */
  async fetchOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    args: unknown[] = [],
  ): Promise<T | undefined> {
    const conn = await this.source.connect();
    try {
      return (await run<T>(conn, sql, args, 'one')) as T | undefined;
    } finally {
      conn.release();
    }
  }

  /** Return every row. */
  async fetchAll<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    args: unknown[] = [],
  ): Promise<T[]> {
    const conn = await this.source.connect();
    try {
      return (await run<T>(conn, sql, args, 'all')) as T[];
    } finally {
      conn.release();
    }
  }

  /** Run one statement and discard the result. The span records
   * `db.rows_affected`, so a DELETE that removes seven rows and a DELETE
   * that removes none look different in the trace. */
  async execute(sql: string, args: unknown[] = []): Promise<void> {
    const conn = await this.source.connect();
    try {
      await run(conn, sql, args, 'none');
    } finally {
      conn.release();
    }
  }

  /** Hold one connection open for several statements.
   *
   * Any thrown error rolls the whole transaction back and propagates,
   * including an error a route throws to answer 403 or 404.
   *
   * The span `pg_transaction` is the parent. Each statement inside opens a
   * `pg_query` child, so a loop over three tags shows six children and the
   * extra round trips become visible.
   */
  async tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return tracer.startActiveSpan('pg_transaction', async (span) => {
      const conn = await this.source.connect();
      try {
        await conn.query('BEGIN');
        const result = await fn(new Tx(conn));
        await conn.query('COMMIT');
        return result;
      } catch (error) {
        await conn.query('ROLLBACK');
        throw error;
      } finally {
        conn.release();
        span.end();
      }
    });
  }
}

/** The same three verbs, on one connection that stays open. */
class Tx {
  private readonly conn: Connection;

  constructor(conn: Connection) {
    this.conn = conn;
  }

  async fetchOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    args: unknown[] = [],
  ): Promise<T | undefined> {
    return (await run<T>(this.conn, sql, args, 'one')) as T | undefined;
  }

  async fetchAll<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    args: unknown[] = [],
  ): Promise<T[]> {
    return (await run<T>(this.conn, sql, args, 'all')) as T[];
  }

  async execute(sql: string, args: unknown[] = []): Promise<void> {
    await run(this.conn, sql, args, 'none');
  }
}
