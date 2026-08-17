SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uk_users_phone_number'
);

SET @duplicate_phone_count = (
  SELECT COUNT(*)
  FROM (
    SELECT phone_number
    FROM users
    WHERE phone_number IS NOT NULL
      AND phone_number <> ''
      AND deleted_at IS NULL
    GROUP BY phone_number
    HAVING COUNT(*) > 1
  ) duplicate_phone_numbers
);

SET @duplicate_guard = IF(
  @index_exists = 0 AND @duplicate_phone_count > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''Cannot add uk_users_phone_number: duplicate active users.phone_number values exist''',
  'DO 0'
);

PREPARE statement FROM @duplicate_guard;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @ddl = IF(
  @index_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY uk_users_phone_number (phone_number)',
  'DO 0'
);

PREPARE statement FROM @ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;
