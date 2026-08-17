-- Phase 1 운영 지표: raw input과 사용자/콘텐츠 식별자를 조회하지 않는다.
SELECT
  aggregate_date,
  decision,
  intent,
  reason_code,
  model,
  prompt_version,
  fallback_used,
  SUM(event_count) AS event_count,
  SUM(persona_called_count) AS persona_called_count,
  SUM(related_feedback_count) AS related_feedback_count,
  SUM(not_related_feedback_count) AS not_related_feedback_count,
  ROUND(SUM(latency_sum_ms) / NULLIF(SUM(event_count), 0), 2) AS average_latency_ms,
  MAX(latency_max_ms) AS maximum_latency_ms
FROM moderation_daily_aggregates
WHERE is_test_data = FALSE
  AND aggregate_date >= CURRENT_DATE - INTERVAL 30 DAY
GROUP BY
  aggregate_date,
  decision,
  intent,
  reason_code,
  model,
  prompt_version,
  fallback_used
ORDER BY aggregate_date DESC, decision, intent, reason_code;

SELECT
  aggregate_date,
  SUM(event_count) AS event_count,
  SUM(CASE WHEN fallback_used THEN event_count ELSE 0 END) AS fallback_count,
  ROUND(
    SUM(CASE WHEN fallback_used THEN event_count ELSE 0 END)
      / NULLIF(SUM(event_count), 0),
    5
  ) AS fallback_rate,
  SUM(related_feedback_count) AS related_feedback_count,
  SUM(not_related_feedback_count) AS not_related_feedback_count
FROM moderation_daily_aggregates
WHERE is_test_data = FALSE
  AND aggregate_date >= CURRENT_DATE - INTERVAL 30 DAY
GROUP BY aggregate_date
ORDER BY aggregate_date DESC;

-- Event retention 기간의 latency p50/p95. 원문과 식별자는 projection에 포함하지 않는다.
WITH ranked_latency AS (
  SELECT
    DATE(created_at) AS event_date,
    latency_ms,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(created_at)
      ORDER BY latency_ms
    ) AS latency_rank,
    COUNT(*) OVER (
      PARTITION BY DATE(created_at)
    ) AS sample_count
  FROM moderation_events
  WHERE is_test_data = FALSE
    AND created_at >= CURRENT_DATE - INTERVAL 30 DAY
)
SELECT
  event_date,
  MAX(sample_count) AS sample_count,
  MIN(CASE
    WHEN latency_rank >= CEIL(sample_count * 0.50) THEN latency_ms
  END) AS latency_p50_ms,
  MIN(CASE
    WHEN latency_rank >= CEIL(sample_count * 0.95) THEN latency_ms
  END) AS latency_p95_ms
FROM ranked_latency
GROUP BY event_date
ORDER BY event_date DESC;
