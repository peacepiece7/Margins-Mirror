-- 목적: window, question, message, persona context를 join해 full session timeline을 점검한다.
SELECT
  rs.id AS session_id,
  rs.title AS session_title,
  sw.id AS window_id,
  sw.window_type,
  sw.title AS window_title,
  m.id AS message_id,
  m.message_order,
  m.role,
  p.display_name AS persona_display_name,
  q.id AS question_id,
  m.content,
  m.created_at
FROM reading_sessions rs
JOIN session_windows sw ON sw.session_id = rs.id
LEFT JOIN messages m ON m.window_id = sw.id AND m.deleted_at IS NULL
LEFT JOIN personas p ON p.id = m.persona_id
LEFT JOIN questions q ON q.id = m.question_id
WHERE rs.id = ? AND rs.deleted_at IS NULL AND sw.deleted_at IS NULL
ORDER BY sw.position, m.message_order, m.id;

SELECT
  h.id AS highlight_id,
  h.session_id,
  h.book_id,
  h.page_number,
  h.location_label,
  h.quote_text,
  h.note,
  h.highlight_order,
  h.created_at
FROM session_highlights h
WHERE h.session_id = ?
  AND h.deleted_at IS NULL
ORDER BY h.highlight_order, h.id;
