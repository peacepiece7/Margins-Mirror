SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_locale'
);
SET @ddl = IF(@column_exists = 0,
  "ALTER TABLE users ADD COLUMN preferred_locale VARCHAR(2) NOT NULL DEFAULT 'en' AFTER email_verified",
  'DO 0');
PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @constraint_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'chk_users_preferred_locale' AND CONSTRAINT_TYPE = 'CHECK'
);
SET @ddl = IF(@constraint_exists = 0,
  "ALTER TABLE users ADD CONSTRAINT chk_users_preferred_locale CHECK (preferred_locale IN ('ko', 'en'))",
  'DO 0');
PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
