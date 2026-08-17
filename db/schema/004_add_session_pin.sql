SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reading_sessions'
    AND COLUMN_NAME = 'is_pinned'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE reading_sessions
    ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE AFTER status',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reading_sessions'
    AND INDEX_NAME = 'idx_reading_sessions_pinned'
);

SET @ddl = IF(
  @index_exists = 0,
  'CREATE INDEX idx_reading_sessions_pinned ON reading_sessions (user_id, is_pinned, updated_at)',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
