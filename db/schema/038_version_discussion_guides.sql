-- Migration 038: Discussion Guide에 생성 brief와 불변 version 계보를 추가한다.
-- 기존 Guide는 승인된 기본 brief를 가진 version 1 current snapshot으로 유지한다.

ALTER TABLE discussion_guides
  DROP INDEX uk_discussion_guides_interview,
  ADD COLUMN purpose VARCHAR(32) NOT NULL DEFAULT 'THOUGHT_EXPANSION'
    COMMENT 'THOUGHT_EXPANSION·ISSUE_EXPLORATION·DISCUSSION_PREP 발제 목적'
    AFTER depth,
  ADD COLUMN audience_mode VARCHAR(20) NOT NULL DEFAULT 'SELF_AI'
    COMMENT 'SELF_AI·SMALL_GROUP 참여 형태'
    AFTER purpose,
  ADD COLUMN target_minutes INT NOT NULL DEFAULT 40
    COMMENT '20·40·60분 목표 진행 시간'
    AFTER audience_mode,
  ADD COLUMN disclosure_mode VARCHAR(24) NOT NULL DEFAULT 'PRIVATE_CONTEXT'
    COMMENT 'PRIVATE_CONTEXT·REFLECTION_ONLY AI 문맥 범위'
    AFTER target_minutes,
  ADD COLUMN guide_version INT NOT NULL DEFAULT 1
    COMMENT 'Interview 안에서 1부터 증가하는 불변 Guide version'
    AFTER generation_metadata_json,
  ADD COLUMN source_guide_id BIGINT NULL
    COMMENT '바로 전 Guide version 식별자'
    AFTER guide_version,
  ADD COLUMN origin VARCHAR(20) NOT NULL DEFAULT 'GENERATED'
    COMMENT 'GENERATED·USER_EDIT·REGENERATED 생성 출처'
    AFTER source_guide_id,
  ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT TRUE
    COMMENT 'Interview의 현재 Guide 여부'
    AFTER origin,
  ADD COLUMN current_interview_id BIGINT
    GENERATED ALWAYS AS (
      CASE WHEN is_current = TRUE THEN interview_id ELSE NULL END
    ) STORED COMMENT 'Interview별 현재 Guide 유일성 키'
    AFTER is_current,
  ADD COLUMN archived_at TIMESTAMP(6) NULL
    COMMENT '새 version으로 대체된 시각'
    AFTER current_interview_id,
  ADD UNIQUE KEY uk_discussion_guides_version (interview_id, guide_version),
  ADD UNIQUE KEY uk_discussion_guides_current_interview (current_interview_id),
  ADD KEY idx_discussion_guides_source (source_guide_id),
  ADD CONSTRAINT fk_discussion_guides_source
    FOREIGN KEY (source_guide_id) REFERENCES discussion_guides (id)
    ON DELETE CASCADE,
  ADD CONSTRAINT chk_discussion_guides_purpose
    CHECK (purpose IN ('THOUGHT_EXPANSION', 'ISSUE_EXPLORATION', 'DISCUSSION_PREP')),
  ADD CONSTRAINT chk_discussion_guides_audience
    CHECK (audience_mode IN ('SELF_AI', 'SMALL_GROUP')),
  ADD CONSTRAINT chk_discussion_guides_target_minutes
    CHECK (target_minutes IN (20, 40, 60)),
  ADD CONSTRAINT chk_discussion_guides_disclosure
    CHECK (disclosure_mode IN ('PRIVATE_CONTEXT', 'REFLECTION_ONLY')),
  ADD CONSTRAINT chk_discussion_guides_version
    CHECK (guide_version >= 1),
  ADD CONSTRAINT chk_discussion_guides_origin
    CHECK (origin IN ('GENERATED', 'USER_EDIT', 'REGENERATED')),
  ADD CONSTRAINT chk_discussion_guides_current_archive
    CHECK (
      (is_current = TRUE AND status <> 'ARCHIVED' AND archived_at IS NULL)
      OR
      (is_current = FALSE AND status = 'ARCHIVED' AND archived_at IS NOT NULL)
    );
