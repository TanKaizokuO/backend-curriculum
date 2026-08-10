const { Client } = require('pg');

const DSN = process.env.DATABASE_URL;
if (!DSN) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DSN });
  await client.connect();

  const userInput = "' OR '1'='1";

  // NEVER do this
  const naive = `SELECT id, title FROM bookmarks WHERE title = '${userInput}'`;
  console.log('naive SQL :', naive);
  try {
    const naiveRes = await client.query(naive);
    console.log('naive rows:', naiveRes.rows);
  } catch (err) {
    console.log('naive error:', err.message);
  }

  // Do this
  const safeRes = await client.query(
    'SELECT id, title FROM bookmarks WHERE title = $1',
    [userInput]
  );
  console.log('safe  rows:', safeRes.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
