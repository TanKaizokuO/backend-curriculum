-- Lesson 6. A counter column, so that two writers can fight over one row.
--
-- NOT NULL DEFAULT 0 is safe on a large table in PostgreSQL 11 and later:
-- the default is stored in the catalogue, so no row is rewritten.

ALTER TABLE bookmarks
    ADD COLUMN visit_count BIGINT NOT NULL DEFAULT 0;
