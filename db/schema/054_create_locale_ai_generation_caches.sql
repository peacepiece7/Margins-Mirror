-- 마이그레이션 054: Reflection 요약·수정 제안의 locale별 cache를 추가한다.
-- 기존 단일 슬롯은 보존하며 이 migration에서 backfill하지 않는다.

CREATE TABLE reflection_summaries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  reflection_insight_id BIGINT NOT NULL,
  generation_locale VARCHAR(2) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  summary TEXT NOT NULL,
  model VARCHAR(120) NOT NULL,
  token_usage_json JSON NULL,
  language_validation_outcome VARCHAR(24) NOT NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reflection_summaries_identity (
    reflection_insight_id, generation_locale, source_hash
  ),
  KEY idx_reflection_summaries_test_data (is_test_data),
  CONSTRAINT fk_reflection_summaries_insight
    FOREIGN KEY (reflection_insight_id) REFERENCES session_insights (id),
  CONSTRAINT chk_reflection_summaries_locale
    CHECK (generation_locale IN ('ko', 'en')),
  CONSTRAINT chk_reflection_summaries_validation
    CHECK (language_validation_outcome IN ('MATCH', 'UNKNOWN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discussion_run_refinements (
  id BIGINT NOT NULL AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  generation_locale VARCHAR(2) NOT NULL,
  input_hash CHAR(64) NOT NULL,
  transcript_hash CHAR(64) NOT NULL,
  prompt_version VARCHAR(80) NOT NULL,
  status VARCHAR(16) NOT NULL,
  suggestion_content TEXT NULL,
  generation_metadata_json JSON NULL,
  language_validation_outcome VARCHAR(24) NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_discussion_run_refinements_identity (
    run_id, generation_locale, input_hash
  ),
  KEY idx_discussion_run_refinements_test_data (is_test_data),
  CONSTRAINT fk_discussion_run_refinements_run
    FOREIGN KEY (run_id) REFERENCES discussion_runs (id),
  CONSTRAINT chk_discussion_run_refinements_locale
    CHECK (generation_locale IN ('ko', 'en')),
  CONSTRAINT chk_discussion_run_refinements_status
    CHECK (status IN ('PENDING', 'READY', 'FAILED')),
  CONSTRAINT chk_discussion_run_refinements_validation
    CHECK (
      language_validation_outcome IS NULL
      OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN')
    ),
  CONSTRAINT chk_discussion_run_refinements_content
    CHECK (
      (
        status = 'READY'
        AND suggestion_content IS NOT NULL
        AND CHAR_LENGTH(TRIM(suggestion_content)) > 0
        AND generated_at IS NOT NULL
      )
      OR (status IN ('PENDING', 'FAILED') AND suggestion_content IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
