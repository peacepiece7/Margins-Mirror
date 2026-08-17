SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND COLUMN_NAME = 'reading_status'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE books
    ADD COLUMN reading_status VARCHAR(40) NOT NULL DEFAULT ''want_to_read'' AFTER raw_metadata,
    ADD COLUMN rating DECIMAL(2,1) NULL AFTER reading_status,
    ADD COLUMN status_started_at TIMESTAMP NULL AFTER rating,
    ADD COLUMN status_finished_at TIMESTAMP NULL AFTER status_started_at',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND INDEX_NAME = 'idx_books_user_status'
);

SET @ddl = IF(
  @index_exists = 0,
  'CREATE INDEX idx_books_user_status ON books (user_id, reading_status, deleted_at)',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND INDEX_NAME = 'idx_books_user_rating'
);

SET @ddl = IF(
  @index_exists = 0,
  'CREATE INDEX idx_books_user_rating ON books (user_id, rating, deleted_at)',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
