/**
 * Apply every .sql file in migrations/ that has not been applied yet.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DSN = process.env.DATABASE_URL;
if (!DSN) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  const client = new Client({ connectionString: DSN });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const res = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(res.rows.map(r => r.version));

    const files = fs.readdirSync(MIGRATIONS_DIR).sort();
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      const version = path.parse(file).name;
      if (applied.has(version)) {
        console.log(`skip    ${version}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log(`applied ${version}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
