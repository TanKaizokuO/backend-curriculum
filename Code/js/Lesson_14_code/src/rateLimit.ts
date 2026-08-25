/**
 * The TypeScript twin of `Code/Lesson_12_code/rate_limit.py`.
 *
 * `localLimiter` counts login attempts in a `Map` that lives inside this
 * one Node process. It is correct behind one instance and silently wrong
 * behind more than one, because a second instance starts counting from
 * zero in a `Map` of its own. See Lesson 12: `benchRateLimit.ts` measures
 * the gap.
 *
 * `redisLimiter` counts attempts in Redis, a store every instance points
 * at. The count means the same thing no matter which instance answers the
 * request, because there is only one counter, not one per process.
 */

/** The one Redis command shape `redisLimiter` needs. `redis`'s own client
 * type carries every module the package bundles, and none of that is part
 * of this contract. */
interface AtomicCounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
}

export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 60;

// Process-local state. Lost on restart, and never seen by another process.
const localAttempts = new Map<string, number[]>();

/** Return true if the request may proceed. A sliding window kept in this
 * process's memory: drop attempts older than the window, then count what
 * is left. */
export function localLimiter(clientIp: string): boolean {
  const now = performance.now();
  const windowStart = now - LOGIN_ATTEMPT_WINDOW_SECONDS * 1000;
  const attempts = (localAttempts.get(clientIp) ?? []).filter((t) => t > windowStart);
  attempts.push(now);
  localAttempts.set(clientIp, attempts);
  return attempts.length <= LOGIN_ATTEMPT_LIMIT;
}

/**
 * Return true if the request may proceed. A fixed window kept in Redis,
 * shared by every process that points at the same server.
 *
 * `INCR` on a missing key creates it at 1 and is atomic, so two instances
 * that both read "4" a moment apart still each get a distinct, correct
 * next count — one becomes 5, the other 6 — instead of both writing 5.
 * `EXPIRE` is set only when this call created the key (`count === 1`), so a
 * slow request from an instance that lost a race never resets a window
 * another instance already started.
 */
export async function redisLimiter(redis: AtomicCounterStore, clientIp: string): Promise<boolean> {
  const key = `login_attempts:${clientIp}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, LOGIN_ATTEMPT_WINDOW_SECONDS);
  }
  return count <= LOGIN_ATTEMPT_LIMIT;
}
