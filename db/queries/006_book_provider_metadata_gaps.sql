-- 목적: external book API 변경 후 saved-book 제공자 메타데이터 gap을 찾는다.
-- 배포 전후 운영 점검에 쓰기 위한 조회다.

SELECT
  id,
  user_id,
  title,
  author,
  source,
  source_ref,
  isbn,
  publisher,
  published_year,
  language_code,
  cover_image_url,
  updated_at
FROM books
WHERE deleted_at IS NULL
  AND source IN ('google', 'openlibrary')
  AND (
    source_ref IS NULL OR TRIM(source_ref) = ''
    OR isbn IS NULL OR TRIM(isbn) = ''
    OR raw_metadata IS NULL
  )
ORDER BY updated_at DESC, id DESC;

SELECT
  user_id,
  LOWER(TRIM(title)) AS normalized_title,
  LOWER(TRIM(COALESCE(author, ''))) AS normalized_author,
  COUNT(*) AS duplicate_count,
  GROUP_CONCAT(id ORDER BY updated_at DESC, id DESC) AS book_ids
FROM books
WHERE deleted_at IS NULL
GROUP BY user_id, LOWER(TRIM(title)), LOWER(TRIM(COALESCE(author, '')))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, normalized_title;
