SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'session_insights'
    AND COLUMN_NAME = 'author_name'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE session_insights
    ADD COLUMN author_name VARCHAR(80) NULL AFTER evidence',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'session_insights'
    AND COLUMN_NAME = 'visibility'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE session_insights
    ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT ''PRIVATE'' AFTER author_name',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'session_insights'
    AND COLUMN_NAME = 'reviewed_on'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE session_insights
    ADD COLUMN reviewed_on DATE NULL AFTER visibility',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'session_insights'
    AND INDEX_NAME = 'idx_session_insights_visibility'
);

SET @ddl = IF(
  @index_exists = 0,
  'CREATE INDEX idx_session_insights_visibility ON session_insights (visibility, deleted_at)',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
