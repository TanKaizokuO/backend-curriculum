// Twelve-factor configuration module

function loadConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('FATAL: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const port = parseInt(process.env.PORT || '8000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    databaseUrl,
    port,
    nodeEnv
  };
}

module.exports = loadConfig();
