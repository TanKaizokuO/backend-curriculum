const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://learner:lesson4@localhost:55432/bookmarks';
const pool = new Pool({ connectionString: DATABASE_URL });

const TARGET_ID = 1;
const WORKERS = 20;
const INCREMENTS_PER_WORKER = 10;
const EXPECTED_TOTAL = WORKERS * INCREMENTS_PER_WORKER; // 200

async function resetCounter() {
  await pool.query('UPDATE bookmarks SET visit_count = 0 WHERE id = $1', [TARGET_ID]);
}

async function getCounter() {
  const { rows } = await pool.query('SELECT visit_count FROM bookmarks WHERE id = $1', [TARGET_ID]);
  return parseInt(rows[0].visit_count, 10);
}

// Strategy 1: Naive (read, increment in JS, update)
async function naiveIncrement() {
  const { rows } = await pool.query('SELECT visit_count FROM bookmarks WHERE id = $1', [TARGET_ID]);
  const current = parseInt(rows[0].visit_count, 10);
  // Simulating minor processing window
  await new Promise(resolve => setTimeout(resolve, 1));
  await pool.query('UPDATE bookmarks SET visit_count = $1 WHERE id = $2', [current + 1, TARGET_ID]);
}

// Strategy 2: Single Atomic SQL Statement
async function singleStatementIncrement() {
  await pool.query('UPDATE bookmarks SET visit_count = visit_count + 1 WHERE id = $1', [TARGET_ID]);
}

// Strategy 3: SELECT FOR UPDATE (Pessimistic Locking)
async function forUpdateIncrement() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT visit_count FROM bookmarks WHERE id = $1 FOR UPDATE', [TARGET_ID]);
    const current = parseInt(rows[0].visit_count, 10);
    await client.query('UPDATE bookmarks SET visit_count = $1 WHERE id = $2', [current + 1, TARGET_ID]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Strategy 4: REPEATABLE READ with Retry Loop (Optimistic Concurrency)
async function repeatableReadIncrement() {
  let retries = 0;
  while (true) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const { rows } = await client.query('SELECT visit_count FROM bookmarks WHERE id = $1', [TARGET_ID]);
      const current = parseInt(rows[0].visit_count, 10);
      await new Promise(resolve => setTimeout(resolve, 1));
      await client.query('UPDATE bookmarks SET visit_count = $1 WHERE id = $2', [current + 1, TARGET_ID]);
      await client.query('COMMIT');
      return retries;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '40001') { // serialization_failure
        retries++;
        await new Promise(resolve => setTimeout(resolve, 5));
      } else {
        throw err;
      }
    } finally {
      client.release();
    }
  }
}

async function runStrategy(name, fn) {
  await resetCounter();
  const startTime = Date.now();
  let totalRetries = 0;

  const workers = Array.from({ length: WORKERS }, async () => {
    for (let i = 0; i < INCREMENTS_PER_WORKER; i++) {
      const retries = await fn();
      if (typeof retries === 'number') {
        totalRetries += retries;
      }
    }
  });

  await Promise.all(workers);
  const elapsed = Date.now() - startTime;
  const finalCount = await getCounter();
  const lost = EXPECTED_TOTAL - finalCount;

  console.log(`\nStrategy: ${name}`);
  console.log(`  Expected count : ${EXPECTED_TOTAL}`);
  console.log(`  Final count    : ${finalCount}`);
  console.log(`  Lost updates   : ${lost}`);
  console.log(`  Elapsed time   : ${elapsed} ms`);
  if (totalRetries > 0) {
    console.log(`  Total retries  : ${totalRetries}`);
  }
}

async function main() {
  console.log(`Running concurrency benchmarks (${WORKERS} workers x ${INCREMENTS_PER_WORKER} increments = ${EXPECTED_TOTAL} total)...`);
  
  await runStrategy('1. Naive (Read-Modify-Write in JS)', naiveIncrement);
  await runStrategy('2. Single Statement (Atomic UPDATE)', singleStatementIncrement);
  await runStrategy('3. SELECT FOR UPDATE (Pessimistic Lock)', forUpdateIncrement);
  await runStrategy('4. REPEATABLE READ (Optimistic Retry)', repeatableReadIncrement);

  await pool.end();
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  pool.end();
});
