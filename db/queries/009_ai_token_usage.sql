-- Provider-reported token usage by call type. NULL usage is intentionally excluded.
SELECT
  'message_response' AS call_type,
  COUNT(*) AS call_count,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(token_usage, '$.inputTokens')) AS UNSIGNED)) AS input_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(token_usage, '$.outputTokens')) AS UNSIGNED)) AS output_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(token_usage, '$.totalTokens')) AS UNSIGNED)) AS total_tokens
FROM messages
WHERE token_usage IS NOT NULL
  AND deleted_at IS NULL

UNION ALL

SELECT
  'reflection_summary' AS call_type,
  COUNT(*) AS call_count,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(summary_token_usage, '$.inputTokens')) AS UNSIGNED)) AS input_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(summary_token_usage, '$.outputTokens')) AS UNSIGNED)) AS output_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(summary_token_usage, '$.totalTokens')) AS UNSIGNED)) AS total_tokens
FROM session_insights
WHERE summary_token_usage IS NOT NULL
  AND deleted_at IS NULL

UNION ALL

SELECT
  'conversation_summary' AS call_type,
  COUNT(*) AS call_count,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummary.tokenUsage.inputTokens')) AS UNSIGNED)) AS input_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummary.tokenUsage.outputTokens')) AS UNSIGNED)) AS output_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummary.tokenUsage.totalTokens')) AS UNSIGNED)) AS total_tokens
FROM session_windows
WHERE JSON_EXTRACT(context_snapshot, '$.conversationSummary.tokenUsage') IS NOT NULL
  AND deleted_at IS NULL

UNION ALL

SELECT
  CONCAT('reflection_summary_', generation_locale) AS call_type,
  COUNT(*) AS call_count,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(token_usage_json, '$.inputTokens')) AS UNSIGNED)) AS input_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(token_usage_json, '$.outputTokens')) AS UNSIGNED)) AS output_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(token_usage_json, '$.totalTokens')) AS UNSIGNED)) AS total_tokens
FROM reflection_summaries
WHERE token_usage_json IS NOT NULL
GROUP BY generation_locale

UNION ALL

SELECT
  'conversation_summary_ko' AS call_type,
  COUNT(*) AS call_count,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.ko.tokenUsage.inputTokens')) AS UNSIGNED)) AS input_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.ko.tokenUsage.outputTokens')) AS UNSIGNED)) AS output_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.ko.tokenUsage.totalTokens')) AS UNSIGNED)) AS total_tokens
FROM session_windows
WHERE JSON_EXTRACT(context_snapshot, '$.conversationSummaries.ko.tokenUsage') IS NOT NULL
  AND deleted_at IS NULL

UNION ALL

SELECT
  'conversation_summary_en' AS call_type,
  COUNT(*) AS call_count,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.en.tokenUsage.inputTokens')) AS UNSIGNED)) AS input_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.en.tokenUsage.outputTokens')) AS UNSIGNED)) AS output_tokens,
  SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.en.tokenUsage.totalTokens')) AS UNSIGNED) ) AS total_tokens
FROM session_windows
WHERE JSON_EXTRACT(context_snapshot, '$.conversationSummaries.en.tokenUsage') IS NOT NULL
  AND deleted_at IS NULL;
