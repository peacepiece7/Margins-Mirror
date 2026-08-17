ALTER TABLE session_insights
  ADD COLUMN summary TEXT NULL AFTER content,
  ADD COLUMN summary_source_hash CHAR(64) NULL AFTER summary,
  ADD COLUMN summary_model VARCHAR(120) NULL AFTER summary_source_hash,
  ADD COLUMN summary_token_usage JSON NULL AFTER summary_model,
  ADD COLUMN summarized_at TIMESTAMP NULL AFTER summary_token_usage,
  ADD COLUMN summary_status VARCHAR(24) NULL AFTER summarized_at;

CREATE INDEX idx_session_insights_summary_status
  ON session_insights (session_id, insight_type, summary_status);
