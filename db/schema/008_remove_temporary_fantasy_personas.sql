UPDATE personas
SET is_active = FALSE,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
WHERE name IN ('warrior-ardan', 'wizard-lyra', 'cleric-seren', 'rogue-nox');

UPDATE messages
SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
WHERE is_test_data = TRUE
  AND id IN (3, 4)
  AND context_snapshot IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.source')) IN ('seed-debate-user', 'seed-persona');

UPDATE session_windows
SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
WHERE is_test_data = TRUE
  AND window_type = 'debate'
  AND title = 'Persona Debate'
  AND JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.seedKey')) = 'debate-window';
