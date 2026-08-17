-- Migration 041: correlate identifier-free AI events with one HTTP request.

ALTER TABLE ai_generation_events
  ADD COLUMN correlation_id CHAR(36) NULL
    COMMENT 'HTTP 요청 상관 UUID; 개인정보·domain 식별자 미포함' AFTER request_id,
  ADD KEY idx_ai_generation_events_correlation_created (correlation_id, created_at);
