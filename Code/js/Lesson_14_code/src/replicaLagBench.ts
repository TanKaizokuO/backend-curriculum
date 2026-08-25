/**
 * The TypeScript twin of `Code/Lesson_12_code/replica_lag_bench.py`. Same
 * primary, same replica, same two experiments — see that file's docstring
 * for how to stand up `pg12-primary` and `pg12-replica`.
 *
 *     node src/replicaLagBench.ts
 */

import { Client } from 'pg';

const PRIMARY_DSN = 'postgresql://postgres:lesson4@localhost:55492/bookmarks';
const REPLICA_DSN = 'postgresql://postgres:lesson4@localhost:55493/bookmarks';
const POLL_INTERVAL_MS = 1;
const POLL_TIMEOUT_MS = 10_000;

async function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  await promise;
}

/**
 * Write a row on the primary. Poll the replica until it appears. Both
 * connections are already open before the write, so the measured gap is
 * replication lag, not connection setup.
 */
async function measureReplicationLag(primary: Client, replica: Client): Promise<void> {
  const writeStart = performance.now();
  const { rows } = await primary.query<{ id: number }>(
    'INSERT INTO bookmarks (url, title) VALUES ($1, $2) RETURNING id',
    [`https://example.com/replica-lag-ts-${Date.now()}-${Math.random()}`, 'replica lag demo ts'],
  );
  const bookmarkId = rows[0]!.id;

  const deadline = writeStart + POLL_TIMEOUT_MS;
  let polls = 0;
  while (performance.now() < deadline) {
    polls += 1;
    const { rows: found } = await replica.query('SELECT 1 FROM bookmarks WHERE id = $1', [bookmarkId]);
    if (found.length > 0) {
      const lag = performance.now() - writeStart;
      console.log(`row visible on the replica after ${lag.toFixed(2)} ms (${polls} polls)`);
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  console.log(`row still not visible after ${POLL_TIMEOUT_MS}ms — replication is stuck`);
}

/**
 * Pause WAL replay on the replica, write on the primary, read the stale
 * answer, resume, then read the fresh one.
 */
async function demonstratePausedReplicaStaleness(): Promise<void> {
  const replica = new Client({ connectionString: REPLICA_DSN });
  await replica.connect();
  await replica.query('SELECT pg_wal_replay_pause()');
  console.log('paused WAL replay on the replica');

  const primary = new Client({ connectionString: PRIMARY_DSN });
  await primary.connect();
  const { rows } = await primary.query<{ id: number }>(
    'INSERT INTO bookmarks (url, title) VALUES ($1, $2) RETURNING id',
    [`https://example.com/paused-ts-${Date.now()}`, 'written while paused'],
  );
  const bookmarkId = rows[0]!.id;
  await primary.end();
  console.log(`inserted bookmark ${bookmarkId} on the primary`);

  const { rows: whilePaused } = await replica.query('SELECT 1 FROM bookmarks WHERE id = $1', [bookmarkId]);
  console.log(`replica sees it while paused: ${whilePaused.length > 0}  <- stale read`);

  await replica.query('SELECT pg_wal_replay_resume()');
  console.log('resumed WAL replay');

  const deadline = performance.now() + POLL_TIMEOUT_MS;
  while (performance.now() < deadline) {
    const { rows: afterResume } = await replica.query('SELECT 1 FROM bookmarks WHERE id = $1', [bookmarkId]);
    if (afterResume.length > 0) {
      console.log('replica sees it now: true  <- caught up');
      await replica.end();
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  console.log('replica never caught up within the timeout');
  await replica.end();
}

console.log('--- 1. ordinary replication lag ---------------------------------');
const primaryConn = new Client({ connectionString: PRIMARY_DSN });
const replicaConn = new Client({ connectionString: REPLICA_DSN });
await primaryConn.connect();
await replicaConn.connect();
for (let i = 0; i < 5; i++) {
  await measureReplicationLag(primaryConn, replicaConn);
}
await primaryConn.end();
await replicaConn.end();

console.log('\n--- 2. a paused replica is a stale replica ----------------------');
await demonstratePausedReplicaStaleness();
