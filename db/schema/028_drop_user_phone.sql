-- 전화번호 없는 application 배포를 검증한 뒤 적용하는 contract migration이다.
SET @phone_column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'phone_number'
);
SET @drop_phone_column = IF(
  @phone_column_exists > 0,
  'ALTER TABLE users DROP COLUMN phone_number',
  'DO 0'
);
PREPARE statement FROM @drop_phone_column;
EXECUTE statement;
DEALLOCATE PREPARE statement;
