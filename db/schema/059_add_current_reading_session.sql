-- Migration 059: make the selected reading session an explicit book-owned relation.
-- Existing content is preserved. Active books are deterministically backfilled to their
-- latest-created active owner-consistent session. Hard-deleting a session clears the pointer so
-- the existing test-reset and account-erasure order remains valid.
ALTER TABLE books
  ADD COLUMN current_reading_session_id BIGINT NULL
    COMMENT '현재 독서 세션 ID' AFTER reading_status;

UPDATE books b
SET b.current_reading_session_id = (
  SELECT rs.id
  FROM reading_sessions rs
  WHERE rs.book_id = b.id
    AND rs.user_id = b.user_id
    AND rs.deleted_at IS NULL
  ORDER BY rs.created_at DESC, rs.id DESC
  LIMIT 1
)
WHERE b.deleted_at IS NULL;

ALTER TABLE books
  ADD KEY idx_books_current_reading_session (current_reading_session_id),
  ADD CONSTRAINT fk_books_current_reading_session
    FOREIGN KEY (current_reading_session_id) REFERENCES reading_sessions (id)
    ON DELETE SET NULL;

ALTER TABLE reading_sessions
  ADD KEY idx_reading_sessions_owner_created
    (user_id, deleted_at, created_at DESC, id DESC),
  ADD KEY idx_reading_sessions_book_owner_created
    (book_id, user_id, deleted_at, created_at DESC, id DESC);
