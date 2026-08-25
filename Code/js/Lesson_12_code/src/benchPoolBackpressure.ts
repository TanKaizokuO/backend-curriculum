/**
 * The TypeScript twin of `Code/Lesson_12_code/bench_pool_backpressure.py`.
 *
 * Same database, same slow link, same two instances — only the stack
 * answering `/bookmarks` changes.
 *
 *     DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \
 *       POOL_MAX_SIZE=10 POOL_ACQUIRE_TIMEOUT_SECONDS=30 PORT=8030 node src/server.ts
 *     DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \
 *       POOL_MAX_SIZE=10 POOL_ACQUIRE_TIMEOUT_SECONDS=30 PORT=8031 node src/server.ts
 *     node src/benchPoolBackpressure.ts --burst 50
 *
 * Right-sized, short timeout:
 *
 *     DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \
 *       POOL_MAX_SIZE=7 POOL_ACQUIRE_TIMEOUT_SECONDS=3 PORT=8030 node src/server.ts
 *     DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \
 *       POOL_MAX_SIZE=7 POOL_ACQUIRE_TIMEOUT_SECONDS=3 PORT=8031 node src/server.ts
 *     node src/benchPoolBackpressure.ts --burst 50
 */

const INSTANCES = ['http://127.0.0.1:8030/bookmarks', 'http://127.0.0.1:8031/bookmarks'];

interface Outcome {
  status: string;
  elapsedSeconds: number;
}

async function one(url: string): Promise<Outcome> {
  const start = performance.now();
  try {
    const response = await fetch(url);
    return { status: String(response.status), elapsedSeconds: (performance.now() - start) / 1000 };
  } catch (error) {
    const name = error instanceof Error ? error.constructor.name : 'UnknownError';
    return { status: `ERR:${name}`, elapsedSeconds: (performance.now() - start) / 1000 };
  }
}

async function run(requestsPerInstance: number): Promise<void> {
  const urls = INSTANCES.flatMap((url) => Array<string>(requestsPerInstance).fill(url));
  const start = performance.now();
  const results = await Promise.all(urls.map((url) => one(url)));
  const total = (performance.now() - start) / 1000;

  const counts: Record<string, number> = {};
  for (const { status } of results) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const latencies = results.map((r) => r.elapsedSeconds).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length / 2)]!;
  const p90 = latencies[Math.floor(latencies.length * 0.9)]!;

  console.log(`${urls.length} requests across ${INSTANCES.length} instances`);
  console.log('status counts:', counts);
  console.log(`wall time: ${total.toFixed(2)}s`);
  console.log(
    `latency  : min ${latencies[0]!.toFixed(2)}s  p50 ${p50.toFixed(2)}s  ` +
      `p90 ${p90.toFixed(2)}s  max ${latencies.at(-1)!.toFixed(2)}s`,
  );
}

const burstFlag = process.argv.indexOf('--burst');
const burst = burstFlag >= 0 ? Number(process.argv[burstFlag + 1]) : 50;
await run(burst);
