-- Lesson 8 — the owner of a row.
--
-- The column is nullable, because 200 000 rows already exist and no user owns
-- them. A NOT NULL column would need a default owner, and a default owner is
-- a lie. New rows get an owner from the request; old rows stay public.

ALTER TABLE bookmarks
    ADD COLUMN user_id INTEGER REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX bookmarks_user_id_idx ON bookmarks (user_id);
