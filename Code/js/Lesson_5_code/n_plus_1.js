/**
 * Measure the N+1 problem against the real database.
 *
 *     export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
 *     node n_plus_1.js
 *
 * Both functions return exactly the same data. Only the number of round trips
 * to PostgreSQL is different.
 */

const { Client } = require('pg');

const DSN = process.env.DATABASE_URL;
if (!DSN) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const PAGE = 100;

async function withNPlus1(client) {
  const res = await client.query(
    'SELECT id, url, title FROM bookmarks ORDER BY id LIMIT $1',
    [PAGE]
  );
  const rows = res.rows;
  let queries = 1;
  for (const row of rows) {
    const tagsRes = await client.query(
      'SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = $1 ORDER BY t.name',
      [row.id]
    );
    queries++;
    row.tags = tagsRes.rows.map(r => r.name);
  }
  return { rows, queries };
}

async function withOneQuery(client) {
  const res = await client.query(
    `
    SELECT b.id, b.url, b.title,
           coalesce(array_agg(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
    FROM (SELECT id, url, title FROM bookmarks ORDER BY id LIMIT $1) b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t           ON t.id = bt.tag_id
    GROUP BY b.id, b.url, b.title
    ORDER BY b.id
    `,
    [PAGE]
  );
  return { rows: res.rows, queries: 1 };
}

async function timeIt(label, fn, client) {
  await fn(client); // warm up
  const start = performance.now();
  const { rows, queries } = await fn(client);
  const elapsed = performance.now() - start;
  console.log(
    `${label.padEnd(14)} ${elapsed.toFixed(1).padStart(7)} ms   ${queries.toString().padStart(4)} queries   ${rows.length} rows   first tags: ${JSON.stringify(rows[0]?.tags || [])}`
  );
  return elapsed;
}

async function main() {
  const client = new Client({ connectionString: DSN });
  await client.connect();
  try {
    const slow = await timeIt('N+1', withNPlus1, client);
    const fast = await timeIt('single query', withOneQuery, client);
    console.log(`\nthe join is ${(slow / fast).toFixed(0)}x faster`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
