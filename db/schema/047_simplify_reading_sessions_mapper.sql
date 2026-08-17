-- Migration 047: reduce reading_sessions to a book-to-conversation mapper.
--
-- Destructive precondition: before applying this migration, the operator must verify
-- that existing reading-session progress/state data may be discarded for production
-- and test accounts. Record the read-only count query and approval in deployment evidence:
--   SELECT COUNT(*) FROM reading_sessions;
-- This migration intentionally has no backfill, export/restore, compatibility layer,
-- UNIQUE(book_id), application lock, or dual-write. Session artifact foreign keys remain.
-- Recovery is a database backup restore plus the previous application release.
ALTER TABLE reading_sessions
  DROP INDEX idx_reading_sessions_status,
  DROP INDEX idx_reading_sessions_pinned,
  DROP COLUMN status,
  DROP COLUMN is_pinned,
  DROP COLUMN reading_goal,
  DROP COLUMN start_page,
  DROP COLUMN current_page,
  DROP COLUMN target_page,
  DROP COLUMN progress_note,
  DROP COLUMN started_at,
  DROP COLUMN completed_at,
  DROP COLUMN summary,
  DROP COLUMN context_snapshot;
