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
  AND deleted_at IS NULL;
