-- Migration 0004: Add visit_count column to bookmarks table
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS visit_count BIGINT NOT NULL DEFAULT 0;
