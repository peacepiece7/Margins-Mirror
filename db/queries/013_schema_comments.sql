-- DBeaver 또는 MySQL client에서 table 설명을 확인한다.
SELECT
    t.TABLE_NAME AS table_name,
    t.TABLE_COMMENT AS table_description
FROM information_schema.TABLES t
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_NAME;

-- DBeaver 또는 MySQL client에서 column 설명을 table 순서대로 확인한다.
SELECT
    c.TABLE_NAME AS table_name,
    c.ORDINAL_POSITION AS column_order,
    c.COLUMN_NAME AS column_name,
    c.COLUMN_TYPE AS column_type,
    c.IS_NULLABLE AS is_nullable,
    c.COLUMN_COMMENT AS column_description
FROM information_schema.COLUMNS c
JOIN information_schema.TABLES t
  ON t.TABLE_SCHEMA = c.TABLE_SCHEMA
 AND t.TABLE_NAME = c.TABLE_NAME
WHERE c.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE'
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;

-- 두 값이 모두 0이면 현행 base table과 column에 설명 누락이 없다.
SELECT
    SUM(CASE WHEN COALESCE(t.TABLE_COMMENT, '') = '' THEN 1 ELSE 0 END)
        AS tables_missing_description,
    (
        SELECT COUNT(*)
        FROM information_schema.COLUMNS c
        JOIN information_schema.TABLES ct
          ON ct.TABLE_SCHEMA = c.TABLE_SCHEMA
         AND ct.TABLE_NAME = c.TABLE_NAME
        WHERE c.TABLE_SCHEMA = DATABASE()
          AND ct.TABLE_TYPE = 'BASE TABLE'
          AND COALESCE(c.COLUMN_COMMENT, '') = ''
    ) AS columns_missing_description
FROM information_schema.TABLES t
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE';
