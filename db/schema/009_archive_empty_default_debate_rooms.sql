UPDATE session_windows sw
SET sw.deleted_at = COALESCE(sw.deleted_at, CURRENT_TIMESTAMP)
WHERE sw.window_type = 'debate'
  AND sw.title = 'Persona Debate'
  AND sw.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM messages m
    WHERE m.window_id = sw.id
      AND m.deleted_at IS NULL
  );
