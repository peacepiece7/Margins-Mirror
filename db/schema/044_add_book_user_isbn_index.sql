SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND INDEX_NAME = 'idx_books_user_isbn'
);

SET @ddl = IF(
  @index_exists = 0,
  'CREATE INDEX idx_books_user_isbn ON books (user_id, isbn, deleted_at)',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
