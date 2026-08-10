const express = require('express');
const { Pool } = require('pg');
const config = require('./config');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Health check endpoint (for deployment orchestrator / Render / Docker healthcheck)
app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', env: config.nodeEnv });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', detail: err.message });
  }
});

// List bookmarks with tags
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

// Create bookmark
app.post('/bookmarks', async (req, res, next) => {
  try {
    const { url, title, tags = [] } = req.body;
    if (!url) {
      return res.status(400).json({ detail: 'URL is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO bookmarks (url, title) VALUES ($1, $2) RETURNING id, url, title, created_at, visit_count',
        [url, title || null]
      );
      const bookmark = rows[0];

      const tagNames = [];
      for (const name of tags) {
        const tagRes = await client.query(
          'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
          [name]
        );
        const tag = tagRes.rows[0];
        await client.query(
          'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [bookmark.id, tag.id]
        );
        tagNames.push(tag.name);
      }

      await client.query('COMMIT');
      bookmark.tags = tagNames;
      res.status(201).json(bookmark);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Bookmarks API listening on http://0.0.0.0:${config.port}`);
  });
}

module.exports = app;
