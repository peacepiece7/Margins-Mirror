CREATE TABLE IF NOT EXISTS moderation_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  user_id BIGINT NOT NULL,
  book_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  window_id BIGINT NOT NULL,
  message_id BIGINT NULL,
  input_text MEDIUMTEXT NULL,
  decision VARCHAR(16) NOT NULL,
  intent VARCHAR(32) NOT NULL,
  relevance_score DECIMAL(6,5) NOT NULL,
  confidence DECIMAL(6,5) NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  suggested_question VARCHAR(500) NULL,
  model VARCHAR(120) NOT NULL,
  policy_version VARCHAR(40) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  schema_version VARCHAR(40) NOT NULL,
  latency_ms INT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  routing_outcome VARCHAR(32) NOT NULL,
  persona_called BOOLEAN NOT NULL DEFAULT FALSE,
  provider_error_code VARCHAR(64) NULL,
  user_feedback VARCHAR(16) NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_moderation_events_request (request_id),
  KEY idx_moderation_events_user_created (user_id, created_at),
  KEY idx_moderation_events_session_created (session_id, created_at),
  KEY idx_moderation_events_window_created (window_id, created_at),
  KEY idx_moderation_events_decision_created (decision, created_at),
  KEY idx_moderation_events_test_data (is_test_data),
  CONSTRAINT fk_moderation_events_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_moderation_events_book FOREIGN KEY (book_id) REFERENCES books (id),
  CONSTRAINT fk_moderation_events_session FOREIGN KEY (session_id) REFERENCES reading_sessions (id),
  CONSTRAINT fk_moderation_events_window FOREIGN KEY (window_id) REFERENCES session_windows (id),
  CONSTRAINT fk_moderation_events_message FOREIGN KEY (message_id) REFERENCES messages (id),
  CONSTRAINT chk_moderation_events_decision
    CHECK (decision IN ('ALLOW', 'REDIRECT', 'REJECT')),
  CONSTRAINT chk_moderation_events_intent
    CHECK (intent IN ('BOOK_DISCUSSION', 'BENIGN_OFF_TOPIC', 'SPAM', 'MEANINGLESS', 'BYPASS_ATTEMPT')),
  CONSTRAINT chk_moderation_events_scores
    CHECK (relevance_score >= 0 AND relevance_score <= 1 AND confidence >= 0 AND confidence <= 1),
  CONSTRAINT chk_moderation_events_feedback
    CHECK (user_feedback IS NULL OR user_feedback IN ('RELATED', 'NOT_RELATED')),
  CONSTRAINT chk_moderation_events_raw_input
    CHECK (
      (decision = 'ALLOW' AND input_text IS NULL)
      OR (decision IN ('REDIRECT', 'REJECT') AND input_text IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moderation_daily_aggregates (
  aggregate_date DATE NOT NULL,
  decision VARCHAR(16) NOT NULL,
  intent VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  model VARCHAR(120) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  event_count BIGINT NOT NULL DEFAULT 0,
  persona_called_count BIGINT NOT NULL DEFAULT 0,
  related_feedback_count BIGINT NOT NULL DEFAULT 0,
  not_related_feedback_count BIGINT NOT NULL DEFAULT 0,
  latency_sum_ms BIGINT NOT NULL DEFAULT 0,
  latency_max_ms INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (
    aggregate_date,
    decision,
    intent,
    reason_code,
    model,
    prompt_version,
    fallback_used,
    is_test_data
  ),
  KEY idx_moderation_daily_aggregates_test_data (is_test_data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
