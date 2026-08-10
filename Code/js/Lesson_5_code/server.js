const express = require('express');
const { Pool } = require('pg');

const DSN = process.env.DATABASE_URL;
if (!DSN) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DSN });
const app = express();
app.use(express.json());

const LIST_SQL = `
SELECT b.id, b.url, b.title, b.created_at,
       coalesce(array_agg(t.name ORDER BY t.name)
                FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
FROM bookmarks b
LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
LEFT JOIN tags t           ON t.id = bt.tag_id
GROUP BY b.id
ORDER BY b.id DESC
OFFSET $1 LIMIT $2
`;

app.get('/bookmarks', async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { rows } = await pool.query(LIST_SQL, [skip, limit]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// N+1 endpoint: 1 + limit queries instead of 1
app.get('/bookmarks/slow', async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { rows } = await pool.query(
      'SELECT id, url, title, created_at FROM bookmarks ORDER BY id LIMIT $1 OFFSET $2',
      [limit, skip]
    );

    for (const row of rows) {
      const { rows: tags } = await pool.query(
        'SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = $1 ORDER BY t.name',
        [row.id]
      );
      row.tags = tags.map(r => r.name);
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Prefix search. Uses index created by migration 0003
app.get('/bookmarks/search', async (req, res, next) => {
  try {
    const title = req.query.title;
    if (!title) {
      return res.status(400).json({ detail: 'Query parameter title is required' });
    }
    const limit = parseInt(req.query.limit, 10) || 20;
    const { rows } = await pool.query(
      'SELECT id, url, title, created_at FROM bookmarks WHERE title LIKE $1 ORDER BY created_at DESC LIMIT $2',
      [`${title}%`, limit]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const GET_SQL = `
SELECT b.id, b.url, b.title, b.created_at,
       coalesce(array_agg(t.name ORDER BY t.name)
                FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
FROM bookmarks b
LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
LEFT JOIN tags t           ON t.id = bt.tag_id
WHERE b.id = $1
GROUP BY b.id
`;

app.get('/bookmarks/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(GET_SQL, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ detail: 'Bookmark not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/bookmarks', async (req, res, next) => {
  const { url, title = null, tags = [] } = req.body || {};
  if (!url) {
    return res.status(400).json({ detail: 'URL is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query(
      'INSERT INTO bookmarks (url, title) VALUES ($1, $2) RETURNING id, url, title, created_at',
      [url, title]
    );
    const bookmark = bRes.rows[0];

    for (const name of tags) {
      const tRes = await client.query(
        'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [name]
      );
      const tagId = tRes.rows[0].id;
      await client.query(
        'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [bookmark.id, tagId]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ...bookmark, tags });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ detail: 'URL already bookmarked' });
    }
    next(err);
  } finally {
    client.release();
  }
});

app.delete('/bookmarks/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query('DELETE FROM bookmarks WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ detail: 'Bookmark not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.listen(8000, () => {
  console.log('Lesson 5 API listening on http://127.0.0.1:8000');
});
