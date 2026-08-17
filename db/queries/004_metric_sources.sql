-- 목적: session-scope metric snapshot 산출에 쓰는 source count를 미리 확인한다.
SELECT
  u.id AS user_id,
  b.id AS book_id,
  rs.id AS session_id,
  COUNT(DISTINCT sw.id) AS window_count,
  COUNT(DISTINCT q.id) AS question_count,
  COUNT(DISTINCT CASE WHEN m.role = 'user' AND m.question_id IS NOT NULL THEN m.question_id END) AS answered_question_count,
  COUNT(DISTINCT h.id) AS highlight_count,
  COUNT(DISTINCT m.id) AS message_count,
  COUNT(DISTINCT m.persona_id) AS persona_count,
  MIN(m.created_at) AS first_message_at,
  MAX(m.created_at) AS last_message_at
FROM users u
JOIN reading_sessions rs ON rs.user_id = u.id AND rs.deleted_at IS NULL
JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
LEFT JOIN session_windows sw ON sw.session_id = rs.id AND sw.deleted_at IS NULL
LEFT JOIN questions q ON q.session_id = rs.id
  AND q.deleted_at IS NULL
  AND (
    q.window_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM session_windows qsw
      WHERE qsw.id = q.window_id
        AND qsw.deleted_at IS NULL
    )
  )
LEFT JOIN session_highlights h ON h.session_id = rs.id AND h.deleted_at IS NULL
LEFT JOIN messages m ON m.session_id = rs.id
  AND m.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM session_windows msw
    WHERE msw.id = m.window_id
      AND msw.deleted_at IS NULL
  )
WHERE u.id = ?
GROUP BY u.id, b.id, rs.id
ORDER BY rs.id;
