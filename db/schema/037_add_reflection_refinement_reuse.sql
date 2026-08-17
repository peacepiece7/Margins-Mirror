-- Migration 037: 동일한 Reflection refinement 입력의 suggestion을 한 번만 생성하고
-- Discussion Run의 private 상태로 재사용한다.

ALTER TABLE discussion_runs
  ADD COLUMN refinement_input_hash CHAR(64) NULL
    COMMENT 'Run·source revision·transcript·prompt 기반 SHA-256 입력 hash'
    AFTER refined_revision_id,
  ADD COLUMN refinement_transcript_hash CHAR(64) NULL
    COMMENT '순서가 고정된 active discussion transcript SHA-256 hash'
    AFTER refinement_input_hash,
  ADD COLUMN refinement_prompt_version VARCHAR(80) NULL
    COMMENT 'Refinement suggestion 생성 prompt 계약 버전'
    AFTER refinement_transcript_hash,
  ADD COLUMN refinement_suggestion_status VARCHAR(16) NULL
    COMMENT 'PENDING·READY·FAILED suggestion 생성 상태'
    AFTER refinement_prompt_version,
  ADD COLUMN refinement_suggestion_content TEXT NULL
    COMMENT '독자가 확정하기 전 private Reflection suggestion'
    AFTER refinement_suggestion_status,
  ADD COLUMN refinement_generation_metadata_json JSON NULL
    COMMENT 'provider·model·prompt·schema·token·latency·outcome 메타데이터'
    AFTER refinement_suggestion_content,
  ADD COLUMN refinement_generated_at TIMESTAMP(6) NULL
    COMMENT 'Suggestion 성공 또는 실패 확정 시각'
    AFTER refinement_generation_metadata_json,
  ADD KEY idx_discussion_runs_refinement_state (
    refinement_suggestion_status,
    refinement_input_hash
  ),
  ADD CONSTRAINT chk_discussion_runs_refinement_suggestion
    CHECK (
      (
        refinement_suggestion_status IS NULL
        AND refinement_input_hash IS NULL
        AND refinement_transcript_hash IS NULL
        AND refinement_prompt_version IS NULL
        AND refinement_suggestion_content IS NULL
        AND refinement_generation_metadata_json IS NULL
        AND refinement_generated_at IS NULL
      )
      OR (
        refinement_suggestion_status = 'PENDING'
        AND refinement_input_hash IS NOT NULL
        AND refinement_transcript_hash IS NOT NULL
        AND refinement_prompt_version IS NOT NULL
        AND refinement_suggestion_content IS NULL
        AND refinement_generation_metadata_json IS NULL
        AND refinement_generated_at IS NULL
      )
      OR (
        refinement_suggestion_status = 'READY'
        AND refinement_input_hash IS NOT NULL
        AND refinement_transcript_hash IS NOT NULL
        AND refinement_prompt_version IS NOT NULL
        AND refinement_suggestion_content IS NOT NULL
        AND refinement_generation_metadata_json IS NOT NULL
        AND refinement_generated_at IS NOT NULL
      )
      OR (
        refinement_suggestion_status = 'FAILED'
        AND refinement_input_hash IS NOT NULL
        AND refinement_transcript_hash IS NOT NULL
        AND refinement_prompt_version IS NOT NULL
        AND refinement_suggestion_content IS NULL
        AND refinement_generation_metadata_json IS NOT NULL
        AND refinement_generated_at IS NOT NULL
      )
    );
