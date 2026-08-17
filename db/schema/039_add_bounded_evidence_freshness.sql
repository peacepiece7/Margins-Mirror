ALTER TABLE book_knowledge
  ADD COLUMN fallback_used BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT '결정적 대체 분석 저장 여부' AFTER status,
  ADD COLUMN generation_claim_token CHAR(36) NULL
    COMMENT '동일 분석 중복 호출 방지 token' AFTER failure_reason,
  ADD COLUMN generation_claimed_at TIMESTAMP(6) NULL
    COMMENT '분석 claim 획득 시각' AFTER generation_claim_token,
  ADD KEY idx_book_knowledge_claim (lookup_key_type, lookup_key, prompt_version, generation_claimed_at);

ALTER TABLE questions
  ADD COLUMN source_version VARCHAR(80) NULL
    COMMENT '질문 생성 시점 Book Knowledge version' AFTER source_excerpt,
  ADD COLUMN source_stale BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT '질문 생성 시점 근거 stale 여부' AFTER source_version,
  ADD COLUMN source_fallback BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT '질문 생성 시점 근거 fallback 여부' AFTER source_stale;

ALTER TABLE discussion_guide_items
  ADD COLUMN source_version VARCHAR(80) NULL
    COMMENT 'Guide 생성 시점 Book Knowledge version' AFTER source_excerpt,
  ADD COLUMN source_stale BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'Guide 생성 시점 근거 stale 여부' AFTER source_version,
  ADD COLUMN source_fallback BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'Guide 생성 시점 근거 fallback 여부' AFTER source_stale;

ALTER TABLE ai_generation_events
  ADD COLUMN failure_category VARCHAR(40) NULL
    COMMENT '식별자 없는 생성 실패 원인 분류' AFTER fallback_used;

UPDATE ai_generation_events
SET failure_category = 'UNCLASSIFIED'
WHERE outcome = 'FAILURE'
  AND failure_category IS NULL;

ALTER TABLE ai_generation_events
  ADD KEY idx_ai_generation_events_failure_created (failure_category, created_at),
  ADD CONSTRAINT chk_ai_generation_events_failure_category
    CHECK (
      (
        outcome = 'FAILURE'
        AND failure_category IN (
          'TIMEOUT',
          'REFUSAL',
          'TRANSPORT',
          'MALFORMED_OUTPUT',
          'SCHEMA_VALIDATION',
          'EVIDENCE_VALIDATION',
          'UNCLASSIFIED'
        )
      )
      OR (
        outcome <> 'FAILURE'
        AND failure_category IS NULL
      )
    );
