-- 목적: session window 하나의 active message를 display order로 점검한다.
SELECT
  m.id,
  m.window_id,
  m.message_order,
  m.role,
  m.content,
  m.ai_model,
  m.persona_id,
  p.display_name AS persona_display_name,
  m.question_id,
  m.token_usage,
  m.streaming_status,
  m.created_at
FROM messages m
JOIN session_windows sw ON sw.id = m.window_id AND sw.deleted_at IS NULL
LEFT JOIN personas p ON p.id = m.persona_id
WHERE m.window_id = ? AND m.deleted_at IS NULL
ORDER BY m.message_order, m.id;
