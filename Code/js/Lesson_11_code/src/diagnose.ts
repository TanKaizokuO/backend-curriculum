/**
 * Lesson 11's payoff, the TypeScript twin of `Code/Lesson_11_code/diagnose.py`.
 *
 *     node src/server.ts    # in one terminal
 *     node src/diagnose.ts  # in another
 *
 * Watch the *server's* terminal while this script runs, and run
 * `curl -s localhost:8009/metrics` after step 4. The claims this lesson
 * makes are about what those two views show, not about what this script
 * prints — this script only produces the requests.
 */

import { Client } from 'pg';

import { config } from './config.ts';

const BASE_URL = `http://127.0.0.1:${config.port}`;
const QUERY = 'Observability demo ts';
const TTL_SECONDS = 30;

function metricValue(text: string, name: string, labels: Record<string, string>): number | null {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  const prefix = labelStr ? `${name}{${labelStr}}` : name;
  for (const line of text.split('\n')) {
    if (line.startsWith(`${prefix} `)) {
      return Number(line.split(' ').at(-1));
    }
  }
  return null;
}

async function search(step: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/bookmarks/search?q=${encodeURIComponent(QUERY)}`);
  const body = (await response.json()) as { source: string; results: unknown[] };
  console.log(
    `${step}: GET /bookmarks/search?q=${JSON.stringify(QUERY)} -> ${response.status}, ` +
      `source=${body.source}, rows=${body.results.length}, ` +
      `request-id=${response.headers.get('x-request-id')}`,
  );
}

async function main(): Promise<void> {
  const pg = new Client({ connectionString: config.databaseUrl });
  await pg.connect();

  try {
    console.log('--- 1. a query nobody has run yet: cache miss ------------------');
    await search('step 1');

    console.log('\n--- 2. the same query again: cache hit -------------------------');
    await search('step 2');

    console.log('\n--- 3. a row inserted straight into Postgres, bypassing the API -');
    await pg.query(
      'INSERT INTO bookmarks (url, title) VALUES ($1, $2) ON CONFLICT (url) DO NOTHING',
      ['https://example.com/observability-demo-ts-new', `${QUERY} — written straight into Postgres`],
    );
    console.log('row inserted with a direct pg connection, no HTTP request made');

    console.log('\n--- 4. the same query, inside the TTL: is it fresh? ------------');
    await search('step 4');

    const metricsText = await (await fetch(`${BASE_URL}/metrics`)).text();
    const miss = metricValue(metricsText, 'bookmark_search_cache_total', { result: 'miss' });
    const hit = metricValue(metricsText, 'bookmark_search_cache_total', { result: 'hit' });
    console.log(`\n/metrics: bookmark_search_cache_total{result="miss"} = ${miss}`);
    console.log(`/metrics: bookmark_search_cache_total{result="hit"}  = ${hit}`);

    console.log(`\nWaiting ${TTL_SECONDS + 1}s for the cache entry to expire...`);
    const { promise: ttlElapsed, resolve: ttlDone } = Promise.withResolvers<void>();
    setTimeout(ttlDone, (TTL_SECONDS + 1) * 1000);
    await ttlElapsed;

    console.log('\n--- 5. the same query, after the TTL: is it fresh now? ---------');
    await search('step 5');
  } finally {
    await pg.end();
  }
}

main();
