SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reading_sessions'
    AND COLUMN_NAME = 'reading_goal'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE reading_sessions
    ADD COLUMN reading_goal VARCHAR(500) NULL AFTER status,
    ADD COLUMN start_page INT NULL AFTER reading_goal,
    ADD COLUMN current_page INT NULL AFTER start_page,
    ADD COLUMN target_page INT NULL AFTER current_page,
    ADD COLUMN progress_note TEXT NULL AFTER target_page',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
