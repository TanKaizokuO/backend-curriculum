/**
 * Lesson 11 in TypeScript — production bootstrap.
 *
 * `app.ts` builds the routes and opens no connection of its own. This file
 * is the one place that does: it builds the `pg` `Pool`, connects Redis,
 * wires a `Db` and a `RedisCache` over them, and calls `createApp` once.
 *
 * `tests/setup.ts` never imports this file, so a test run never opens a
 * `Pool` or a Redis connection this module creates — it builds its own
 * `Db` and a `DictCache` and calls `createApp` directly.
 *
 * Run it:
 *
 *     node src/migrate.ts
 *     node src/server.ts
 */

import { Pool } from 'pg';
import { createClient } from 'redis';

import { createApp } from './app.ts';
import { Db } from './db.ts';
import { RedisCache } from './cache.ts';
import { config } from './config.ts';

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const redis = createClient({ url: config.redisUrl });
redis.on('error', (error) => console.error('redis error', error));
await redis.connect();

const app = createApp({ db: new Db(pool), cache: new RedisCache(redis) });

export { app, pool, redis };
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`bookmarks api listening on http://0.0.0.0:${config.port}`);
  });
}
