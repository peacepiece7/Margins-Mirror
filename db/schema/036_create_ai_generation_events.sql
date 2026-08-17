CREATE TABLE IF NOT EXISTS ai_generation_events (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'AI 생성 event 식별자',
  request_id CHAR(36) NOT NULL COMMENT '내부 호출 추적 UUID',
  task_type VARCHAR(40) NOT NULL COMMENT 'AI 생성 task 유형',
  depth VARCHAR(16) NULL COMMENT 'SIMPLE·STANDARD·DEEP 실행 깊이',
  provider VARCHAR(64) NOT NULL COMMENT 'AI provider 식별자',
  model VARCHAR(120) NOT NULL COMMENT 'AI model 식별자',
  prompt_version VARCHAR(64) NOT NULL COMMENT 'domain prompt 버전',
  schema_version VARCHAR(64) NOT NULL COMMENT 'domain 응답 schema 버전',
  input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'provider 보고 input token',
  cached_input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'provider 보고 cached input token',
  output_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'provider 보고 output token',
  latency_ms INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '호출 완료 지연 ms',
  outcome VARCHAR(24) NOT NULL COMMENT 'SUCCESS·FALLBACK·FAILURE 결과',
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE COMMENT '결정적 fallback 사용 여부',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 event 구분',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'event 생성 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_generation_events_request (request_id),
  KEY idx_ai_generation_events_task_depth_created (task_type, depth, created_at),
  KEY idx_ai_generation_events_provider_model_created (provider, model, created_at),
  KEY idx_ai_generation_events_test_data (is_test_data),
  CONSTRAINT chk_ai_generation_events_depth
    CHECK (depth IS NULL OR depth IN ('SIMPLE', 'STANDARD', 'DEEP')),
  CONSTRAINT chk_ai_generation_events_outcome
    CHECK (outcome IN ('SUCCESS', 'FALLBACK', 'FAILURE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='식별자 없는 AI 생성 운영 event';
