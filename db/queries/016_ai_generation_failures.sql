-- Identifier-free AI failure classification snapshot.
-- Historical failures stay UNCLASSIFIED; no raw content or product/user identifier is selected.
WITH report_windows AS (
  SELECT
    'CURRENT_7D' AS window_label,
    CURRENT_TIMESTAMP(6) - INTERVAL 7 DAY AS start_at,
    CURRENT_TIMESTAMP(6) AS end_at
  UNION ALL
  SELECT
    'CURRENT_30D',
    CURRENT_TIMESTAMP(6) - INTERVAL 30 DAY,
    CURRENT_TIMESTAMP(6)
),
failure_rows AS (
  SELECT
    w.window_label,
    e.task_type,
    COALESCE(e.depth, 'UNSCOPED') AS depth,
    e.provider,
    e.model,
    e.prompt_version,
    e.schema_version,
    COALESCE(e.failure_category, 'UNCLASSIFIED') AS failure_category,
    COUNT(*) AS failure_count,
    SUM(e.input_tokens) AS input_tokens,
    SUM(e.cached_input_tokens) AS cached_input_tokens,
    SUM(e.output_tokens) AS output_tokens,
    MIN(e.latency_ms) AS latency_min_ms,
    MAX(e.latency_ms) AS latency_max_ms,
    COUNT(DISTINCT DATE(e.created_at)) AS active_days
  FROM report_windows w
  JOIN ai_generation_events e
    ON e.created_at >= w.start_at
   AND e.created_at < w.end_at
  WHERE e.is_test_data = FALSE
    AND e.outcome = 'FAILURE'
  GROUP BY
    w.window_label,
    e.task_type,
    COALESCE(e.depth, 'UNSCOPED'),
    e.provider,
    e.model,
    e.prompt_version,
    e.schema_version,
    COALESCE(e.failure_category, 'UNCLASSIFIED')
)
SELECT JSON_OBJECT(
  'snapshotSchemaVersion', 'ai-generation-failure-snapshot-v1',
  'windowLabel', window_label,
  'taskType', task_type,
  'depth', depth,
  'provider', provider,
  'model', model,
  'promptVersion', prompt_version,
  'schemaVersion', schema_version,
  'failureCategory', failure_category,
  'failureCount', failure_count,
  'inputTokens', input_tokens,
  'cachedInputTokens', cached_input_tokens,
  'outputTokens', output_tokens,
  'latencyMinMs', latency_min_ms,
  'latencyMaxMs', latency_max_ms,
  'activeDays', active_days
) AS failure_snapshot_json
FROM failure_rows
ORDER BY
  FIELD(window_label, 'CURRENT_7D', 'CURRENT_30D'),
  task_type,
  depth,
  provider,
  model,
  prompt_version,
  schema_version,
  failure_category;
