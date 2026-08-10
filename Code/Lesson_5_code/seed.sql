-- Lesson 5 seed: enough rows that a sequential scan is honestly slow.
--
--   docker cp seed.sql pg-bookmarks:/seed.sql
--   docker exec pg-bookmarks psql -U learner -d bookmarks -f /seed.sql
--
-- Run it after the Lesson 4 migrations. It replaces the table contents.

TRUNCATE bookmark_tags, tags, bookmarks RESTART IDENTITY;

INSERT INTO bookmarks (url, title, created_at)
SELECT
    'https://example.com/article/' || n,
    'Article number ' || n,
    now() - (n || ' minutes')::interval
FROM generate_series(1, 200000) AS n;

INSERT INTO tags (name)
SELECT 'tag-' || n FROM generate_series(1, 40) AS n;

-- every bookmark gets 3 tags, spread so that no tag is trivially rare
INSERT INTO bookmark_tags (bookmark_id, tag_id)
SELECT b.id, 1 + ((b.id * k) % 40)
FROM bookmarks b, generate_series(1, 3) AS k
ON CONFLICT DO NOTHING;

-- ANALYZE updates the statistics the planner uses to choose a plan.
-- Always run it after a bulk load, or your EXPLAIN output is a lie.
ANALYZE bookmarks;
ANALYZE tags;
ANALYZE bookmark_tags;
