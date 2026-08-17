-- 목적: editable book metadata 기준으로 저장된 AI profile이 없거나 오래된 book을 찾는다.
SELECT
  b.id AS book_id,
  b.title,
  b.author,
  b.published_year,
  b.isbn,
  JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.title')) AS profile_title,
  JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.author')) AS profile_author,
  JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.isbn')) AS profile_isbn,
  JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.publishedYear')) AS profile_published_year
FROM books b
WHERE b.raw_metadata IS NULL
  OR JSON_EXTRACT(b.raw_metadata, '$.aiProfile') IS NULL
  OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.title')), '') <> b.title
  OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.author')), '') <> COALESCE(b.author, '')
  OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.isbn')), '') <> COALESCE(b.isbn, '')
  OR COALESCE(
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(b.raw_metadata, '$.aiProfile.publishedYear')), 'null') AS SIGNED),
    -2147483648
  ) <> COALESCE(b.published_year, -2147483648)
ORDER BY b.updated_at DESC, b.id DESC;
