/**
 * The TypeScript twin of `Code/Lesson_8_code/event_loop_block.py`.
 *
 * Start the API first:
 *
 *     node src/server.ts
 *
 * Then:
 *
 *     node src/eventLoopBlock.ts
 *
 * Node runs one JavaScript thread. `bcrypt.compareSync` holds it for about
 * 190 ms, so every other request waits. `bcrypt.compare` hands the work to
 * the libuv thread pool and the loop stays free.
 *
 * Python calls this "the event loop". Node calls it "the event loop". The
 * defect and the fix are the same in both.
 */

import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:8009';
const EMAIL = 'ada@example.com';
const WRONG = 'not the password at all';
const LOGINS = 10;
const PROBES = 20;

async function flood(path: string): Promise<number> {
  const start = performance.now();
  await Promise.all(
    Array.from({ length: LOGINS }, () =>
      fetch(BASE + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: WRONG }),
      }),
    ),
  );
  return performance.now() - start;
}

async function probe(): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < PROBES; i += 1) {
    const start = performance.now();
    await fetch(`${BASE}/healthz`);
    samples.push(performance.now() - start);
    await sleep(10);
  }
  return samples;
}

for (let i = 0; i < 3; i += 1) await fetch(`${BASE}/healthz`); // warm the pool
let start = performance.now();
for (let i = 0; i < 20; i += 1) await fetch(`${BASE}/healthz`);
console.log(`/healthz with nothing else running : ${((performance.now() - start) / 20).toFixed(1)} ms`);

console.log(`\n${LOGINS} logins at once, ${PROBES} health checks during them\n`);
console.log(
  `${'login route'.padEnd(24)} ${'logins total'.padStart(13)} ${'/healthz p50'.padStart(13)} ${'/healthz max'.padStart(13)}`,
);

for (const path of ['/auth/login-blocking', '/auth/login']) {
  start = performance.now();
  const [total, samples] = await Promise.all([flood(path), probe()]);
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length / 2)] ?? 0;
  console.log(
    `${path.padEnd(24)} ${total.toFixed(0).padStart(10)} ms ` +
      `${p50.toFixed(1).padStart(10)} ms ${Math.max(...samples).toFixed(1).padStart(10)} ms`,
  );
}

console.log('\nThe blocking route also serialises the logins themselves:');
console.log('one thread runs one bcrypt at a time. The thread pool does not.');
