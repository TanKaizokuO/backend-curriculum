const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://learner:lesson4@localhost:55432/bookmarks';
const pool = new Pool({ connectionString: DATABASE_URL });

const PORT = process.env.PORT || 8000;

// List bookmarks with aggregated tags
app.get('/bookmarks', async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 10;
    const query = `
      SELECT b.id, b.url, b.title, b.created_at, b.visit_count,
             coalesce(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      LEFT JOIN tags t ON t.id = bt.tag_id
      GROUP BY b.id
      ORDER BY b.id DESC
      OFFSET $1 LIMIT $2
    `;
    const { rows } = await pool.query(query, [skip, limit]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Increment visit count (Atomic UPDATE)
app.post('/bookmarks/:id/visit', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const query = `
      UPDATE bookmarks
      SET visit_count = visit_count + 1
      WHERE id = $1
      RETURNING id, url, title, created_at, visit_count
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ detail: 'Bookmark not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ detail: 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
