/**
 * The TypeScript twin of `Code/Lesson_10_code/cache_bench.py`.
 *
 *     PORT=8009 node src/server.ts   # in one terminal
 *     node src/cacheBench.ts         # in another
 *
 * Same three steps: miss against hit, then a stale read, then the fix.
 */

import { Client } from 'pg';
import { createClient } from 'redis';

import { config } from './config.ts';

const BASE_URL = `http://127.0.0.1:${config.port}`;
const QUERY = 'Article number 1370';
const STALE_QUERY = 'Cache demo';

async function timedGet(path: string): Promise<[number, unknown]> {
  const start = performance.now();
  const response = await fetch(`${BASE_URL}${path}`);
  const elapsedMs = performance.now() - start;
  return [elapsedMs, await response.json()];
}

async function benchMissVsHit(redis: ReturnType<typeof createClient>): Promise<void> {
  console.log('--- 1. miss against hit -----------------------------------');
  const key = `search:${QUERY}:0:10`;
  const misses: number[] = [];
  for (let i = 0; i < 5; i++) {
    await redis.del(key);
    const [elapsedMs] = await timedGet(`/bookmarks/search?q=${encodeURIComponent(QUERY)}`);
    misses.push(elapsedMs);
  }

  const hits: number[] = [];
  for (let i = 0; i < 5; i++) {
    const [elapsedMs] = await timedGet(`/bookmarks/search?q=${encodeURIComponent(QUERY)}`);
    hits.push(elapsedMs);
  }

  const avgMiss = misses.reduce((a, b) => a + b, 0) / misses.length;
  const avgHit = hits.reduce((a, b) => a + b, 0) / hits.length;
  console.log('miss (database each time):', misses);
  console.log('hit  (Redis each time):   ', hits);
  console.log(
    `average miss: ${avgMiss.toFixed(3)} ms, average hit: ${avgHit.toFixed(3)} ms, ` +
      `${(avgMiss / avgHit).toFixed(1)}x faster`,
  );
}

async function benchStaleRead(pg: Client): Promise<void> {
  console.log('\n--- 2. the stale read ---------------------------------------');
  await pg.query('DELETE FROM bookmarks WHERE url = $1', ['https://example.com/cache-demo-ts']);

  const [, before] = await timedGet(`/bookmarks/search?q=${encodeURIComponent(STALE_QUERY)}`);
  console.log('before insert:', before);

  await pg.query('INSERT INTO bookmarks (url, title) VALUES ($1, $2)', [
    'https://example.com/cache-demo-ts',
    'Cache demo row ts',
  ]);
  console.log('inserted a matching row directly in PostgreSQL, bypassing the API');

  const [, stillCached] = await timedGet(`/bookmarks/search?q=${encodeURIComponent(STALE_QUERY)}`);
  console.log('right after insert (within the 30s TTL):', stillCached);

  console.log('waiting 31s for the cache entry to expire ...');
  await new Promise((resolve) => setTimeout(resolve, 31_000));

  const [, fresh] = await timedGet(`/bookmarks/search?q=${encodeURIComponent(STALE_QUERY)}`);
  console.log('after the TTL:', fresh);

  await pg.query('DELETE FROM bookmarks WHERE url = $1', ['https://example.com/cache-demo-ts']);
}

async function main(): Promise<void> {
  const redis = createClient({ url: config.redisUrl });
  await redis.connect();
  const pg = new Client({ connectionString: config.databaseUrl });
  await pg.connect();

  try {
    await benchMissVsHit(redis);
    await benchStaleRead(pg);
  } finally {
    await redis.quit();
    await pg.end();
  }
}

main();
