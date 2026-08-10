/**
 * The release step, in TypeScript.
 *
 *     node src/migrate.ts
 *
 * It writes the same version strings as `Code/Lesson_8_code/migrate.py` — the
 * file name without the extension — so one database can serve both stacks.
 * The runner is idempotent: it reads `schema_migrations`, skips what it
 * finds, and applies the rest in one transaction each.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

import { config } from './config.ts';

const directory = path.join(import.meta.dirname, '..', 'migrations');
const client = new Client({ connectionString: config.databaseUrl });

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
const applied = new Set(rows.map((row) => row.version));

for (const file of fs.readdirSync(directory).filter((f) => f.endsWith('.sql')).sort()) {
  const version = path.basename(file, '.sql');
  if (applied.has(version)) {
    console.log(`skip    ${version}`);
    continue;
  }
  await client.query('BEGIN');
  try {
    await client.query(fs.readFileSync(path.join(directory, file), 'utf8'));
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
    console.log(`applied ${version}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

await client.end();
