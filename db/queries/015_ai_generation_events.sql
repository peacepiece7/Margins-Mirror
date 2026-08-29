-- Production AI generation aggregate snapshot.
-- Returns JSON lines only; no raw content or product/user identifier is selected.
WITH
report_windows AS (
  SELECT
    'CURRENT_7D' AS window_label,
    7 AS window_days,
    CURRENT_TIMESTAMP(6) - INTERVAL 7 DAY AS start_at,
    CURRENT_TIMESTAMP(6) AS end_at
  UNION ALL
  SELECT
    'PREVIOUS_7D',
    7,
    CURRENT_TIMESTAMP(6) - INTERVAL 14 DAY,
    CURRENT_TIMESTAMP(6) - INTERVAL 7 DAY
  UNION ALL
  SELECT
    'CURRENT_30D',
    30,
    CURRENT_TIMESTAMP(6) - INTERVAL 30 DAY,
    CURRENT_TIMESTAMP(6)
),
windowed_events AS (
  SELECT
    w.window_label,
    w.window_days,
    e.id,
    e.task_type,
    COALESCE(e.depth, 'UNSCOPED') AS depth,
    e.provider,
    e.model,
    e.prompt_version,
    e.schema_version,
    COALESCE(e.generation_locale, 'UNSCOPED') AS generation_locale,
    COALESCE(e.language_validation_outcome, 'NOT_RECORDED') AS language_validation_outcome,
    e.input_tokens,
    e.cached_input_tokens,
    e.output_tokens,
    e.input_tokens + e.output_tokens AS total_tokens,
    e.latency_ms,
    e.outcome,
    e.fallback_used,
    e.created_at
  FROM report_windows w
  JOIN ai_generation_events e
    ON e.created_at >= w.start_at
   AND e.created_at < w.end_at
  WHERE e.is_test_data = FALSE
),
ranked_events AS (
  SELECT
    we.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        window_label, task_type, depth, provider, model, prompt_version, schema_version,
        generation_locale, language_validation_outcome
      ORDER BY output_tokens, id
    ) AS output_rank,
    ROW_NUMBER() OVER (
      PARTITION BY
        window_label, task_type, depth, provider, model, prompt_version, schema_version,
        generation_locale, language_validation_outcome
      ORDER BY latency_ms, id
    ) AS latency_rank,
    COUNT(*) OVER (
      PARTITION BY
        window_label, task_type, depth, provider, model, prompt_version, schema_version,
        generation_locale, language_validation_outcome
    ) AS task_call_count,
    ROW_NUMBER() OVER (
      PARTITION BY window_label
      ORDER BY output_tokens, id
    ) AS window_output_rank,
    ROW_NUMBER() OVER (
      PARTITION BY window_label
      ORDER BY latency_ms, id
    ) AS window_latency_rank,
    COUNT(*) OVER (PARTITION BY window_label) AS window_call_count
  FROM windowed_events we
),
daily_totals AS (
  SELECT
    window_label,
    DATE(created_at) AS event_date,
    SUM(total_tokens) AS total_tokens
  FROM windowed_events
  GROUP BY window_label, DATE(created_at)
),
daily_peaks AS (
  SELECT window_label, MAX(total_tokens) AS daily_peak_total_tokens
  FROM daily_totals
  GROUP BY window_label
),
task_daily_totals AS (
  SELECT
    window_label,
    task_type,
    depth,
    provider,
    model,
    prompt_version,
    schema_version,
    generation_locale,
    language_validation_outcome,
    DATE(created_at) AS event_date,
    SUM(total_tokens) AS total_tokens
  FROM windowed_events
  GROUP BY
    window_label,
    task_type,
    depth,
    provider,
    model,
    prompt_version,
    schema_version,
    generation_locale,
    language_validation_outcome,
    DATE(created_at)
),
task_daily_peaks AS (
  SELECT
    window_label,
    task_type,
    depth,
    provider,
    model,
    prompt_version,
    schema_version,
    generation_locale,
    language_validation_outcome,
    MAX(total_tokens) AS daily_peak_total_tokens
  FROM task_daily_totals
  GROUP BY
    window_label,
    task_type,
    depth,
    provider,
    model,
    prompt_version,
    schema_version,
    generation_locale,
    language_validation_outcome
),
window_metrics AS (
  SELECT
    w.window_label,
    w.window_days,
    'WINDOW_TOTAL' AS row_scope,
    NULL AS task_type,
    NULL AS depth,
    NULL AS provider,
    NULL AS model,
    NULL AS prompt_version,
    NULL AS schema_version,
    NULL AS generation_locale,
    NULL AS language_validation_outcome,
    COUNT(r.id) AS call_count,
    COALESCE(SUM(r.input_tokens), 0) AS input_tokens,
    COALESCE(SUM(r.cached_input_tokens), 0) AS cached_input_tokens,
    COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
    COALESCE(SUM(r.total_tokens), 0) AS total_tokens,
    SUM(CASE WHEN r.outcome = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN r.outcome = 'FALLBACK' THEN 1 ELSE 0 END) AS fallback_count,
    SUM(CASE WHEN r.outcome = 'FAILURE' THEN 1 ELSE 0 END) AS failure_count,
    MIN(CASE
      WHEN r.window_output_rank >= CEIL(r.window_call_count * 0.50) THEN r.output_tokens
    END) AS output_p50_tokens,
    MIN(CASE
      WHEN r.window_output_rank >= CEIL(r.window_call_count * 0.95) THEN r.output_tokens
    END) AS output_p95_tokens,
    MIN(CASE
      WHEN r.window_latency_rank >= CEIL(r.window_call_count * 0.50) THEN r.latency_ms
    END) AS latency_p50_ms,
    MIN(CASE
      WHEN r.window_latency_rank >= CEIL(r.window_call_count * 0.95) THEN r.latency_ms
    END) AS latency_p95_ms,
    COUNT(DISTINCT DATE(r.created_at)) AS active_days,
    COALESCE(MAX(dp.daily_peak_total_tokens), 0) AS daily_peak_total_tokens
  FROM report_windows w
  LEFT JOIN ranked_events r ON r.window_label = w.window_label
  LEFT JOIN daily_peaks dp ON dp.window_label = w.window_label
  GROUP BY w.window_label, w.window_days
),
task_metrics AS (
  SELECT
    r.window_label,
    r.window_days,
    'TASK_VERSION' AS row_scope,
    r.task_type,
    r.depth,
    r.provider,
    r.model,
    r.prompt_version,
    r.schema_version,
    r.generation_locale,
    r.language_validation_outcome,
    MAX(r.task_call_count) AS call_count,
    SUM(r.input_tokens) AS input_tokens,
    SUM(r.cached_input_tokens) AS cached_input_tokens,
    SUM(r.output_tokens) AS output_tokens,
    SUM(r.total_tokens) AS total_tokens,
    SUM(CASE WHEN r.outcome = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN r.outcome = 'FALLBACK' THEN 1 ELSE 0 END) AS fallback_count,
    SUM(CASE WHEN r.outcome = 'FAILURE' THEN 1 ELSE 0 END) AS failure_count,
    MIN(CASE
      WHEN r.output_rank >= CEIL(r.task_call_count * 0.50) THEN r.output_tokens
    END) AS output_p50_tokens,
    MIN(CASE
      WHEN r.output_rank >= CEIL(r.task_call_count * 0.95) THEN r.output_tokens
    END) AS output_p95_tokens,
    MIN(CASE
      WHEN r.latency_rank >= CEIL(r.task_call_count * 0.50) THEN r.latency_ms
    END) AS latency_p50_ms,
    MIN(CASE
      WHEN r.latency_rank >= CEIL(r.task_call_count * 0.95) THEN r.latency_ms
    END) AS latency_p95_ms,
    COUNT(DISTINCT DATE(r.created_at)) AS active_days,
    MAX(tdp.daily_peak_total_tokens) AS daily_peak_total_tokens
  FROM ranked_events r
  JOIN task_daily_peaks tdp
    ON tdp.window_label = r.window_label
   AND tdp.task_type = r.task_type
   AND tdp.depth = r.depth
   AND tdp.provider = r.provider
   AND tdp.model = r.model
   AND tdp.prompt_version = r.prompt_version
   AND tdp.schema_version = r.schema_version
   AND tdp.generation_locale = r.generation_locale
   AND tdp.language_validation_outcome = r.language_validation_outcome
  GROUP BY
    r.window_label,
    r.window_days,
    r.task_type,
    r.depth,
    r.provider,
    r.model,
    r.prompt_version,
    r.schema_version,
    r.generation_locale,
    r.language_validation_outcome
),
snapshot_rows AS (
  SELECT * FROM window_metrics
  UNION ALL
  SELECT * FROM task_metrics
)
SELECT JSON_OBJECT(
  'snapshotSchemaVersion', 'ai-generation-cost-snapshot-v2',
  'windowLabel', window_label,
  'windowDays', window_days,
  'scope', row_scope,
  'taskType', task_type,
  'depth', depth,
  'provider', provider,
  'model', model,
  'promptVersion', prompt_version,
  'schemaVersion', schema_version,
  'generationLocale', generation_locale,
  'languageValidationOutcome', language_validation_outcome,
  'callCount', call_count,
  'inputTokens', input_tokens,
  'cachedInputTokens', cached_input_tokens,
  'outputTokens', output_tokens,
  'totalTokens', total_tokens,
  -- Cast both operands before division so MySQL cannot reduce the ratio's
  -- scale before ROUND serializes it into the JSON contract.
  'cachedInputRatio', ROUND(
    CAST(cached_input_tokens AS DECIMAL(30, 10)) /
      NULLIF(CAST(input_tokens AS DECIMAL(30, 10)), 0),
    5
  ),
  'successCount', success_count,
  'successRate', ROUND(
    CAST(success_count AS DECIMAL(30, 10)) /
      NULLIF(CAST(call_count AS DECIMAL(30, 10)), 0),
    5
  ),
  'fallbackCount', fallback_count,
  'fallbackRate', ROUND(
    CAST(fallback_count AS DECIMAL(30, 10)) /
      NULLIF(CAST(call_count AS DECIMAL(30, 10)), 0),
    5
  ),
  'failureCount', failure_count,
  'failureRate', ROUND(
    CAST(failure_count AS DECIMAL(30, 10)) /
      NULLIF(CAST(call_count AS DECIMAL(30, 10)), 0),
    5
  ),
  'outputP50Tokens', output_p50_tokens,
  'outputP95Tokens', output_p95_tokens,
  'latencyP50Ms', latency_p50_ms,
  'latencyP95Ms', latency_p95_ms,
  'activeDays', active_days,
  'dailyPeakTotalTokens', daily_peak_total_tokens,
  'callsPerUserAction', NULL,
  'actionRatioStatus', 'NOT_OBSERVABLE'
) AS snapshot_json
FROM snapshot_rows
ORDER BY
  FIELD(window_label, 'CURRENT_7D', 'PREVIOUS_7D', 'CURRENT_30D'),
  FIELD(row_scope, 'WINDOW_TOTAL', 'TASK_VERSION'),
  task_type,
  depth,
  provider,
  model,
  prompt_version,
  schema_version;
