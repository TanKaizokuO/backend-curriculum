/**
 * The TypeScript twin of `Code/Lesson_8_code/config.py`.
 *
 * Python uses pydantic-settings. Node has no equivalent in the standard
 * library, so zod does the same job: read the environment, check the types,
 * and stop the process when a value is missing or malformed.
 *
 * A container that refuses to start beats a container that starts and writes
 * to the wrong database.
 */

import 'dotenv/config';
import { z } from 'zod';

const Schema = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  SECRET_KEY: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8009),
  TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(60 * 24 * 7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(16).default(12),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Bad configuration.');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  databaseUrl: env.DATABASE_URL,
  secretKey: env.SECRET_KEY,
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  tokenTtlSeconds: env.TOKEN_TTL_MINUTES * 60,
  sessionTtlSeconds: env.SESSION_TTL_MINUTES * 60,
  bcryptRounds: env.BCRYPT_ROUNDS,
  /** Send the cookie over HTTPS only, except on a development machine. */
  cookieSecure: env.NODE_ENV !== 'development',
} as const;
