-- Migration 040: Guide facilitation difficulty and immutable Interview answer revisions.

-- Some databases created before the current reset/cleanup contract can retain legacy Guide or
-- Interview rows whose historical Reflection projection was already removed while the FK was
-- disabled. MySQL validates those existing rows when ALTER TABLE rebuilds the table. Preserve
-- those immutable snapshots instead of deleting or rewriting them; checks are disabled only for
-- the two legacy-table ALTER statements and are restored before the new answer table/backfill.
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE discussion_guides
  ADD COLUMN facilitation_level VARCHAR(16) NOT NULL DEFAULT 'BEGINNER'
    COMMENT 'BEGINNER·EXPERIENCED·EXPERT 진행 난이도; answer-count depth와 분리'
    AFTER purpose,
  ADD CONSTRAINT chk_discussion_guides_facilitation_level
    CHECK (facilitation_level IN ('BEGINNER', 'EXPERIENCED', 'EXPERT'));

-- Existing Guide versions predate the UI difficulty choice. Preserve their broader original
-- behavior as EXPERIENCED; only newly created versions use the BEGINNER default.
UPDATE discussion_guides
SET facilitation_level = 'EXPERIENCED'
WHERE facilitation_level = 'BEGINNER';

ALTER TABLE reflection_interviews
  ADD COLUMN parent_interview_id BIGINT NULL
    COMMENT 'RESTART_FROM_HERE fork의 직전 Interview 식별자'
    AFTER user_id,
  ADD COLUMN fork_question_id BIGINT NULL
    COMMENT '새 lineage가 분기한 원 질문 식별자'
    AFTER parent_interview_id,
  ADD KEY idx_reflection_interviews_parent (parent_interview_id),
  ADD KEY idx_reflection_interviews_fork_question (fork_question_id),
  ADD CONSTRAINT fk_reflection_interviews_parent
    FOREIGN KEY (parent_interview_id) REFERENCES reflection_interviews (id),
  ADD CONSTRAINT fk_reflection_interviews_fork_question
    FOREIGN KEY (fork_question_id) REFERENCES questions (id);

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE reflection_interview_answer_revisions (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Interview answer immutable revision 식별자',
  interview_id BIGINT NOT NULL COMMENT '답변을 소유하는 Interview 식별자',
  question_id BIGINT NOT NULL COMMENT '답변 대상 Interview question 식별자',
  session_insight_id BIGINT NOT NULL COMMENT '현재 question_answer projection 식별자',
  user_id BIGINT NOT NULL COMMENT '레코드 소유 사용자 식별자',
  version INT NOT NULL COMMENT '질문별 1부터 증가하는 answer version',
  content TEXT NOT NULL COMMENT '독자가 확정한 immutable 답변 내용',
  response_mode VARCHAR(20) NOT NULL DEFAULT 'ANSWER' COMMENT 'ANSWER response mode',
  revision_kind VARCHAR(20) NOT NULL COMMENT 'WORDING_ONLY·RESTART_FROM_HERE',
  source_answer_revision_id BIGINT NULL COMMENT '직전 answer revision 식별자',
  is_current BOOLEAN NOT NULL DEFAULT TRUE COMMENT '질문별 현재 revision 여부',
  current_question_id BIGINT
    GENERATED ALWAYS AS (
      CASE WHEN is_current = TRUE THEN question_id ELSE NULL END
    ) STORED COMMENT '질문별 current revision 유일성 키',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '로컬·테스트 전용 데이터 여부',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'revision 생성 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_reflection_answer_revision_version (interview_id, question_id, version),
  UNIQUE KEY uk_reflection_answer_revision_current (interview_id, current_question_id),
  KEY idx_reflection_answer_revision_question (question_id, created_at),
  KEY idx_reflection_answer_revision_projection (session_insight_id),
  KEY idx_reflection_answer_revision_user (user_id),
  KEY idx_reflection_answer_revision_source (source_answer_revision_id),
  KEY idx_reflection_answer_revision_test_data (is_test_data),
  CONSTRAINT fk_reflection_answer_revision_interview
    FOREIGN KEY (interview_id) REFERENCES reflection_interviews (id),
  CONSTRAINT fk_reflection_answer_revision_question
    FOREIGN KEY (question_id) REFERENCES questions (id),
  CONSTRAINT fk_reflection_answer_revision_projection
    FOREIGN KEY (session_insight_id) REFERENCES session_insights (id),
  CONSTRAINT fk_reflection_answer_revision_user
    FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_reflection_answer_revision_source
    FOREIGN KEY (source_answer_revision_id) REFERENCES reflection_interview_answer_revisions (id),
  CONSTRAINT chk_reflection_answer_revision_version CHECK (version >= 1),
  CONSTRAINT chk_reflection_answer_revision_mode CHECK (response_mode = 'ANSWER'),
  CONSTRAINT chk_reflection_answer_revision_kind
    CHECK (revision_kind IN ('WORDING_ONLY', 'RESTART_FROM_HERE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reflection Interview 답변의 immutable revision history';

-- Existing question_answer projections become version 1 without exposing their content to
-- any identifier-free generation event. New writes append instead of mutating this table.
INSERT INTO reflection_interview_answer_revisions (
  interview_id,
  question_id,
  session_insight_id,
  user_id,
  version,
  content,
  response_mode,
  revision_kind,
  is_current,
  is_test_data
)
SELECT
  q.reflection_interview_id,
  q.id,
  si.id,
  si.user_id,
  1,
  si.content,
  'ANSWER',
  'WORDING_ONLY',
  TRUE,
  si.is_test_data
FROM session_insights si
INNER JOIN questions q
  ON q.id = si.question_id
 AND q.reflection_interview_id IS NOT NULL
WHERE si.insight_type = 'question_answer'
  AND si.deleted_at IS NULL;
