CREATE INDEX IF NOT EXISTS bookmarks_title_pattern_idx ON bookmarks (title text_pattern_ops);
