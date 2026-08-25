/**
 * Lesson 11 in TypeScript — the twin of `Code/Lesson_11_code/cache.py`.
 *
 * `search_bookmarks` used to reach `redis` directly. That made the route
 * untestable without a running Redis server, and it hid the cache logic —
 * the key, the TTL, the hit/miss counter — inside the route.
 *
 * `SearchCache` names the two operations the route needs: `lookup` and
 * `store`. `RedisCache` is the production adapter. `DictCache` is the test
 * adapter — no server, no network, same interface.
 */

import { cacheResult, logEvent } from './observability.ts';

/** The two Redis operations `RedisCache` needs. A minimal, structural type
 * — not `RedisClientType` — sidesteps `redis`'s deeply generic client type
 * and states exactly what this module depends on. */
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
}

export const DEFAULT_TTL_SECONDS = 30;

export interface SearchCache {
  /** Return the cached rows, or `null` on a miss or an expired entry. */
  lookup(q: string, skip: number, limit: number): Promise<unknown[] | null>;
  /** Save `rows` under this query's key, for the cache's TTL. */
  store(q: string, skip: number, limit: number, rows: unknown[]): Promise<void>;
}

function key(q: string, skip: number, limit: number): string {
  return `search:${q}:${skip}:${limit}`;
}

/** Production adapter. Stores each result set as JSON text in Redis. */
export class RedisCache implements SearchCache {
  private readonly redis: RedisLike;
  private readonly ttlSeconds: number;

  constructor(redis: RedisLike, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
  }

  async lookup(q: string, skip: number, limit: number): Promise<unknown[] | null> {
    const cacheKey = key(q, skip, limit);
    const cached = await this.redis.get(cacheKey);
    if (cached === null) {
      cacheResult.labels('miss').inc();
      logEvent({ event: 'search_cache', result: 'miss', key: cacheKey });
      return null;
    }
    cacheResult.labels('hit').inc();
    logEvent({ event: 'search_cache', result: 'hit', key: cacheKey });
    return JSON.parse(cached);
  }

  async store(q: string, skip: number, limit: number, rows: unknown[]): Promise<void> {
    const cacheKey = key(q, skip, limit);
    await this.redis.set(cacheKey, JSON.stringify(rows), { EX: this.ttlSeconds });
  }
}

/** Test adapter. A `Map` stands in for Redis; a stored expiry time stands
 * in for Redis's own `EXPIRE`. `lookup` reads the clock and treats a stale
 * entry as a miss, so a TTL test needs no running server and no real
 * `sleep()` longer than the TTL it is testing. */
export class DictCache implements SearchCache {
  private readonly entries = new Map<string, { expiresAt: number; payload: string }>();

  private readonly ttlSeconds: number;

  constructor(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
    this.ttlSeconds = ttlSeconds;
  }

  async lookup(q: string, skip: number, limit: number): Promise<unknown[] | null> {
    const cacheKey = key(q, skip, limit);
    const entry = this.entries.get(cacheKey);
    if (entry !== undefined) {
      if (performance.now() < entry.expiresAt) {
        cacheResult.labels('hit').inc();
        logEvent({ event: 'search_cache', result: 'hit', key: cacheKey });
        return JSON.parse(entry.payload);
      }
      this.entries.delete(cacheKey);
    }
    cacheResult.labels('miss').inc();
    logEvent({ event: 'search_cache', result: 'miss', key: cacheKey });
    return null;
  }

  async store(q: string, skip: number, limit: number, rows: unknown[]): Promise<void> {
    const cacheKey = key(q, skip, limit);
    const expiresAt = performance.now() + this.ttlSeconds * 1000;
    this.entries.set(cacheKey, { expiresAt, payload: JSON.stringify(rows) });
  }
}
