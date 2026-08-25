/**
 * The TypeScript twin of `Code/Lesson_12_code/bench_rate_limit.py`.
 *
 * The account exists once; every run reuses it.
 *
 *     node src/benchRateLimit.ts --register
 *
 * Direct against one instance, `RATE_LIMIT_BACKEND=local`:
 *
 *     RATE_LIMIT_BACKEND=local PORT=8030 node src/server.ts
 *     node src/benchRateLimit.ts --flush --base-url http://127.0.0.1:8030
 *
 * Through the proxy, two instances, still `local`:
 *
 *     RATE_LIMIT_BACKEND=local PORT=8030 node src/server.ts   # terminal 1
 *     RATE_LIMIT_BACKEND=local PORT=8031 node src/server.ts   # terminal 2
 *     node src/roundRobinProxy.ts                               # terminal 3
 *     node src/benchRateLimit.ts --flush --base-url http://127.0.0.1:8032
 *
 * Fixed, same two instances, `redis`:
 *
 *     RATE_LIMIT_BACKEND=redis PORT=8030 node src/server.ts
 *     RATE_LIMIT_BACKEND=redis PORT=8031 node src/server.ts
 *     node src/roundRobinProxy.ts
 *     node src/benchRateLimit.ts --flush --base-url http://127.0.0.1:8032
 *
 * Every login attempt is its own `fetch` with no keep-alive agent reused
 * across calls, so the proxy round-robins each one separately.
 */

import { createClient } from 'redis';

const EMAIL = 'scaling-demo@example.com';
const PASSWORD = 'correct horse battery staple';
const ATTEMPTS = 14;

async function register(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = (await response.json()) as { detail?: string };
  console.log(`register -> ${response.status} (${body.detail ?? 'created'})`);
}

async function flush(): Promise<void> {
  const client = createClient({ url: 'redis://localhost:6379' });
  await client.connect();
  const deleted = await client.del('login_attempts:127.0.0.1');
  await client.quit();
  console.log(`flushed Redis key login_attempts:127.0.0.1 (existed: ${Boolean(deleted)})`);
}

async function run(baseUrl: string): Promise<void> {
  let first429: number | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    console.log(`attempt ${String(attempt).padStart(2)} -> ${response.status}`);
    if (response.status === 429 && first429 === null) {
      first429 = attempt;
    }
  }
  console.log();
  console.log(first429 ? `first 429 at attempt ${first429}` : `no 429 in ${ATTEMPTS} attempts`);
}

const args = process.argv.slice(2);
const baseUrlFlag = args.indexOf('--base-url');
const baseUrl = baseUrlFlag >= 0 ? args[baseUrlFlag + 1]! : 'http://127.0.0.1:8030';

if (args.includes('--register')) {
  await register(baseUrl);
} else {
  if (args.includes('--flush')) {
    await flush();
  }
  await run(baseUrl);
}
