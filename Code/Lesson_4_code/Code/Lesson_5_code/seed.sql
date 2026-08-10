-- Lesson 5 seed: enough rows that a sequential scan is honestly slow.
-- Run once:  psql "$DATABASE_URL" -f seed.sql

TRUNCATE bookmark_tags, tags, bookmarks RESTART IDENTITY;

INSERT INTO bookmarks (url, title, created_at)
SELECT
    'https://example.com/article/' || n,
    'Article number ' || n,
    now() - (n || ' minutes')::interval
FROM generate_series(1, 200000) AS n;

INSERT INTO tags (name)
SELECT 'tag-' || n FROM generate_series(1, 40) AS n;

-- every bookmark gets 3 tags, spread so no tag is trivially rare
INSERT INTO bookmark_tags (bookmark_id, tag_id)
SELECT b.id, 1 + ((b.id * k) % 40)
FROM bookmarks b, generate_series(1, 3) AS k
ON CONFLICT DO NOTHING;

ANALYZE bookmarks;
ANALYZE tags;
ANALYZE bookmark_tags;
