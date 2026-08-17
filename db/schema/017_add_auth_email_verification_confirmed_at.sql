SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_email_verifications'
    AND COLUMN_NAME = 'confirmed_at'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE auth_email_verifications ADD COLUMN confirmed_at TIMESTAMP NULL AFTER used_at',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
