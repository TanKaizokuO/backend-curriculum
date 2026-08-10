const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/bookmarks', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM bookmarks');
  res.json(rows);
});

// Naive bind to 127.0.0.1 instead of 0.0.0.0
app.listen(8000, '127.0.0.1', () => {
  console.log('Naive server listening on http://127.0.0.1:8000');
});
