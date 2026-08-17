SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'phone_number'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE users ADD COLUMN phone_number VARCHAR(32) NULL AFTER email_verified',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
