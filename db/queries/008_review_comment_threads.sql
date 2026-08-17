-- 목적: review, book, author, parent context와 함께 공개 리뷰 comment 스레드를 점검한다.
SELECT
  rc.insight_id,
  si.title AS review_title,
  b.title AS book_title,
  rc.id AS comment_id,
  rc.parent_comment_id,
  u.display_name AS author_name,
  rc.content,
  rc.created_at,
  rc.updated_at
FROM review_comments rc
JOIN session_insights si ON si.id = rc.insight_id AND si.deleted_at IS NULL
JOIN reading_sessions rs ON rs.id = si.session_id AND rs.deleted_at IS NULL
JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
JOIN users u ON u.id = rc.user_id AND u.deleted_at IS NULL
WHERE si.visibility = 'PUBLIC'
  AND rc.deleted_at IS NULL
ORDER BY rc.insight_id,
  COALESCE(rc.parent_comment_id, rc.id),
  rc.parent_comment_id IS NOT NULL,
  rc.created_at,
  rc.id;
