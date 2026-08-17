-- 목적: debate debugging을 위해 persona-authored message를 persona definition과 함께 추적한다.
SELECT
  m.id AS message_id,
  m.session_id,
  m.window_id,
  m.message_order,
  m.content,
  p.id AS persona_id,
  p.name AS persona_name,
  p.display_name AS persona_display_name,
  p.system_prompt
FROM messages m
JOIN personas p ON p.id = m.persona_id
WHERE m.session_id = ?
  AND m.persona_id IS NOT NULL
  AND m.deleted_at IS NULL
ORDER BY m.window_id, m.message_order, m.id;
