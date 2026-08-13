import { beforeAll } from 'vitest';
import { Client } from 'pg';
import { config } from '../src/config.ts';

beforeAll(async () => {
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.end();

  // import runs the top-level await in migrate.ts
  await import('../src/migrate.ts');
});
