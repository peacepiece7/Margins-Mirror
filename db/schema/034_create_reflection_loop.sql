-- Migration 034: primary Reflection의 revision, adaptive interview,
-- five-stage guide, guided discussion run 상태를 추가한다.

CREATE TABLE reflection_revisions (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Reflection revision 고유 식별자',
  reflection_insight_id BIGINT NOT NULL COMMENT '현재 Reflection projection 식별자',
  session_id BIGINT NOT NULL COMMENT '관련 독서 세션 식별자',
  user_id BIGINT NOT NULL COMMENT '레코드 소유 사용자 식별자',
  version INT NOT NULL COMMENT 'Reflection별 1부터 증가하는 revision 번호',
  content TEXT NOT NULL COMMENT '해당 revision의 사용자 확정 본문',
  revision_source VARCHAR(32) NOT NULL COMMENT 'INITIAL·USER_EDIT·DISCUSSION_REFINE·REREAD 수정 출처',
  source_revision_id BIGINT NULL COMMENT '토론·재독 수정이 출발한 이전 revision 식별자',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '로컬·테스트 전용 데이터 여부',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'revision 생성 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_reflection_revisions_version (reflection_insight_id, version),
  KEY idx_reflection_revisions_session (session_id, reflection_insight_id, version),
  KEY idx_reflection_revisions_user (user_id),
  KEY idx_reflection_revisions_source (source_revision_id),
  KEY idx_reflection_revisions_test_data (is_test_data),
  CONSTRAINT fk_reflection_revisions_insight
    FOREIGN KEY (reflection_insight_id) REFERENCES session_insights (id),
  CONSTRAINT fk_reflection_revisions_session
    FOREIGN KEY (session_id) REFERENCES reading_sessions (id),
  CONSTRAINT fk_reflection_revisions_user
    FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_reflection_revisions_source
    FOREIGN KEY (source_revision_id) REFERENCES reflection_revisions (id),
  CONSTRAINT chk_reflection_revisions_source
    CHECK (revision_source IN ('INITIAL', 'USER_EDIT', 'DISCUSSION_REFINE', 'REREAD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reflection 불변 revision 이력';

INSERT INTO reflection_revisions (
  reflection_insight_id,
  session_id,
  user_id,
  version,
  content,
  revision_source,
  is_test_data,
  created_at
)
SELECT
  si.id,
  si.session_id,
  si.user_id,
  1,
  si.content,
  'INITIAL',
  si.is_test_data,
  si.created_at
FROM session_insights si
WHERE si.insight_type = 'reflection'
  AND si.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM reflection_revisions rr
    WHERE rr.reflection_insight_id = si.id
  );

CREATE TABLE reflection_interviews (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Reflection Interview 고유 식별자',
  reflection_insight_id BIGINT NOT NULL COMMENT '대상 Reflection projection 식별자',
  source_revision_id BIGINT NOT NULL COMMENT 'Interview 문맥으로 고정한 revision 식별자',
  session_id BIGINT NOT NULL COMMENT '관련 독서 세션 식별자',
  window_id BIGINT NOT NULL COMMENT '질문 생성 문맥용 Reflection 작업 공간 식별자',
  user_id BIGINT NOT NULL COMMENT '레코드 소유 사용자 식별자',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE·GUIDE_READY·COMPLETED·ABANDONED 진행 상태',
  coverage_json JSON NOT NULL COMMENT '답변으로 확인한 coverage 분류 목록',
  answered_count INT NOT NULL DEFAULT 0 COMMENT 'ANSWER 방식 저장 답변 수',
  skipped_count INT NOT NULL DEFAULT 0 COMMENT 'SKIP·BOOK_ONLY 선택 누적 수',
  generated_count INT NOT NULL DEFAULT 0 COMMENT '생성된 질문 누적 수·최대 7',
  prompt_version VARCHAR(80) NOT NULL COMMENT '질문 생성 prompt 계약 버전',
  active_source_revision_id BIGINT
    GENERATED ALWAYS AS (
      CASE WHEN status IN ('ACTIVE', 'GUIDE_READY') THEN source_revision_id ELSE NULL END
    ) STORED COMMENT '동일 revision의 활성 Interview 유일성 키',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '로컬·테스트 전용 데이터 여부',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Interview 생성 시각',
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6) COMMENT 'Interview 최종 변경 시각',
  completed_at TIMESTAMP(6) NULL COMMENT 'Interview 완료 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_reflection_interviews_active_revision (active_source_revision_id),
  KEY idx_reflection_interviews_reflection (reflection_insight_id, created_at),
  KEY idx_reflection_interviews_session (session_id),
  KEY idx_reflection_interviews_window (window_id),
  KEY idx_reflection_interviews_user (user_id),
  KEY idx_reflection_interviews_test_data (is_test_data),
  CONSTRAINT fk_reflection_interviews_insight
    FOREIGN KEY (reflection_insight_id) REFERENCES session_insights (id),
  CONSTRAINT fk_reflection_interviews_revision
    FOREIGN KEY (source_revision_id) REFERENCES reflection_revisions (id),
  CONSTRAINT fk_reflection_interviews_session
    FOREIGN KEY (session_id) REFERENCES reading_sessions (id),
  CONSTRAINT fk_reflection_interviews_window
    FOREIGN KEY (window_id) REFERENCES session_windows (id),
  CONSTRAINT fk_reflection_interviews_user
    FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_reflection_interviews_status
    CHECK (status IN ('ACTIVE', 'GUIDE_READY', 'COMPLETED', 'ABANDONED')),
  CONSTRAINT chk_reflection_interviews_counts
    CHECK (
      answered_count BETWEEN 0 AND 7
      AND skipped_count BETWEEN 0 AND 7
      AND generated_count BETWEEN 0 AND 7
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reflection 기반 one-question-at-a-time Interview 상태';

ALTER TABLE questions
  ADD COLUMN reflection_interview_id BIGINT NULL COMMENT '관련 Reflection Interview 식별자' AFTER user_id,
  ADD COLUMN coverage_area VARCHAR(40) NULL COMMENT '질문이 확인하는 Reflection coverage 분류' AFTER question_type,
  ADD COLUMN response_mode VARCHAR(20) NULL COMMENT 'ANSWER·BOOK_ONLY·SKIP 독자 응답 방식' AFTER coverage_area,
  ADD COLUMN source_type VARCHAR(32) NULL COMMENT 'REFLECTION·ANSWER·HIGHLIGHT·BOOK_KNOWLEDGE 질문 근거 종류' AFTER response_mode,
  ADD COLUMN source_ref_id BIGINT NULL COMMENT '같은 사용자·세션 안의 질문 근거 레코드 식별자' AFTER source_type,
  ADD COLUMN source_excerpt VARCHAR(500) NULL COMMENT 'UI에 표시하는 제한 길이 근거 발췌' AFTER source_ref_id,
  ADD COLUMN sensitivity VARCHAR(16) NULL COMMENT 'LOW·MEDIUM·HIGH 질문 민감도' AFTER source_excerpt,
  ADD KEY idx_questions_reflection_interview (reflection_interview_id, id),
  ADD CONSTRAINT fk_questions_reflection_interview
    FOREIGN KEY (reflection_interview_id) REFERENCES reflection_interviews (id),
  ADD CONSTRAINT chk_questions_response_mode
    CHECK (response_mode IS NULL OR response_mode IN ('ANSWER', 'BOOK_ONLY', 'SKIP')),
  ADD CONSTRAINT chk_questions_coverage_area
    CHECK (
      coverage_area IS NULL OR coverage_area IN (
        'FIRST_IMPRESSION',
        'TEXTUAL_INTERPRETATION',
        'PERSONAL_RESPONSE',
        'ALTERNATIVE_VIEW',
        'SOCIAL_VALUE',
        'REFLECTION_FOCUS'
      )
    ),
  ADD CONSTRAINT chk_questions_source_type
    CHECK (
      source_type IS NULL OR source_type IN (
        'REFLECTION',
        'ANSWER',
        'HIGHLIGHT',
        'BOOK_KNOWLEDGE'
      )
    ),
  ADD CONSTRAINT chk_questions_sensitivity
    CHECK (sensitivity IS NULL OR sensitivity IN ('LOW', 'MEDIUM', 'HIGH'));

CREATE TABLE discussion_guides (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Discussion Guide 고유 식별자',
  reflection_insight_id BIGINT NOT NULL COMMENT '대상 Reflection projection 식별자',
  source_revision_id BIGINT NOT NULL COMMENT 'Guide 문맥으로 고정한 revision 식별자',
  interview_id BIGINT NOT NULL COMMENT 'Guide를 생성한 Interview 식별자',
  session_id BIGINT NOT NULL COMMENT '관련 독서 세션 식별자',
  user_id BIGINT NOT NULL COMMENT '레코드 소유 사용자 식별자',
  depth VARCHAR(16) NOT NULL COMMENT 'SIMPLE·STANDARD·DEEP 발제 깊이',
  goal VARCHAR(500) NOT NULL COMMENT '토론 목표',
  issues_json JSON NOT NULL COMMENT '핵심 토론 논점 2~4개',
  status VARCHAR(20) NOT NULL DEFAULT 'READY' COMMENT 'READY·ACTIVE·COMPLETED·ARCHIVED 진행 상태',
  prompt_version VARCHAR(80) NOT NULL COMMENT 'Guide 생성 prompt 계약 버전',
  model VARCHAR(120) NULL COMMENT 'Guide 생성 AI 모델명',
  token_usage_json JSON NULL COMMENT 'Guide 생성 AI 토큰 사용량',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '로컬·테스트 전용 데이터 여부',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Guide 생성 시각',
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6) COMMENT 'Guide 최종 변경 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_discussion_guides_interview (interview_id),
  KEY idx_discussion_guides_reflection (reflection_insight_id, created_at),
  KEY idx_discussion_guides_session (session_id),
  KEY idx_discussion_guides_user (user_id),
  KEY idx_discussion_guides_test_data (is_test_data),
  CONSTRAINT fk_discussion_guides_insight
    FOREIGN KEY (reflection_insight_id) REFERENCES session_insights (id),
  CONSTRAINT fk_discussion_guides_revision
    FOREIGN KEY (source_revision_id) REFERENCES reflection_revisions (id),
  CONSTRAINT fk_discussion_guides_interview
    FOREIGN KEY (interview_id) REFERENCES reflection_interviews (id),
  CONSTRAINT fk_discussion_guides_session
    FOREIGN KEY (session_id) REFERENCES reading_sessions (id),
  CONSTRAINT fk_discussion_guides_user
    FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_discussion_guides_depth
    CHECK (depth IN ('SIMPLE', 'STANDARD', 'DEEP')),
  CONSTRAINT chk_discussion_guides_status
    CHECK (status IN ('READY', 'ACTIVE', 'COMPLETED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reflection Interview 기반 5단계 발제안';

CREATE TABLE discussion_guide_items (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Discussion Guide item 고유 식별자',
  guide_id BIGINT NOT NULL COMMENT '소속 Discussion Guide 식별자',
  question_id BIGINT NOT NULL COMMENT '메시지 trace에 재사용하는 질문 식별자',
  stage VARCHAR(24) NOT NULL COMMENT 'WARM_UP·INTERPRETATION·EXPERIENCE·SOCIAL_VALUE·CLOSING 단계',
  priority VARCHAR(16) NOT NULL COMMENT 'REQUIRED·OPTIONAL 우선순위',
  item_order INT NOT NULL COMMENT 'Guide 안의 표시·진행 순서',
  intent VARCHAR(500) NOT NULL COMMENT '질문 의도',
  source_type VARCHAR(32) NOT NULL COMMENT 'REFLECTION·ANSWER·HIGHLIGHT·BOOK_KNOWLEDGE 근거 종류',
  source_ref_id BIGINT NULL COMMENT '같은 사용자·세션 안의 근거 레코드 식별자',
  source_excerpt VARCHAR(500) NOT NULL COMMENT '독자에게 표시하는 제한 길이 근거 발췌',
  sensitivity VARCHAR(16) NOT NULL COMMENT 'LOW·MEDIUM·HIGH 질문 민감도',
  skippable BOOLEAN NOT NULL DEFAULT TRUE COMMENT '독자가 항목을 건너뛸 수 있는지 여부',
  expected_minutes INT NOT NULL COMMENT '예상 대화 시간·분',
  follow_ups_json JSON NOT NULL COMMENT '최대 두 개의 후속 질문 목록',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '로컬·테스트 전용 데이터 여부',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Guide item 생성 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_discussion_guide_items_order (guide_id, item_order),
  UNIQUE KEY uk_discussion_guide_items_question (question_id),
  KEY idx_discussion_guide_items_stage (guide_id, stage),
  KEY idx_discussion_guide_items_test_data (is_test_data),
  CONSTRAINT fk_discussion_guide_items_guide
    FOREIGN KEY (guide_id) REFERENCES discussion_guides (id),
  CONSTRAINT fk_discussion_guide_items_question
    FOREIGN KEY (question_id) REFERENCES questions (id),
  CONSTRAINT chk_discussion_guide_items_stage
    CHECK (stage IN ('WARM_UP', 'INTERPRETATION', 'EXPERIENCE', 'SOCIAL_VALUE', 'CLOSING')),
  CONSTRAINT chk_discussion_guide_items_priority
    CHECK (priority IN ('REQUIRED', 'OPTIONAL')),
  CONSTRAINT chk_discussion_guide_items_source
    CHECK (source_type IN ('REFLECTION', 'ANSWER', 'HIGHLIGHT', 'BOOK_KNOWLEDGE')),
  CONSTRAINT chk_discussion_guide_items_sensitivity
    CHECK (sensitivity IN ('LOW', 'MEDIUM', 'HIGH')),
  CONSTRAINT chk_discussion_guide_items_minutes
    CHECK (expected_minutes BETWEEN 1 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Discussion Guide 단계별 필수·선택 질문';

CREATE TABLE discussion_runs (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Guided Discussion Run 고유 식별자',
  guide_id BIGINT NOT NULL COMMENT '진행할 Discussion Guide 식별자',
  window_id BIGINT NOT NULL COMMENT '토론 transcript를 저장하는 session window 식별자',
  session_id BIGINT NOT NULL COMMENT '관련 독서 세션 식별자',
  user_id BIGINT NOT NULL COMMENT '레코드 소유 사용자 식별자',
  current_item_id BIGINT NULL COMMENT '현재 진행 중인 Guide item 식별자',
  status VARCHAR(20) NOT NULL DEFAULT 'READY' COMMENT 'READY·ACTIVE·COMPLETED·ABANDONED 진행 상태',
  refinement_outcome VARCHAR(32) NULL COMMENT 'DEEPENED·NEW_PERSPECTIVE·CHANGED·KEPT 수정 결과',
  refined_revision_id BIGINT NULL COMMENT '토론 뒤 사용자 확정 Reflection revision 식별자',
  director_version VARCHAR(80) NOT NULL COMMENT 'Discussion Director 결정 계약 버전',
  last_director_action VARCHAR(32) NULL COMMENT '가장 최근 Director 진행 결정',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '로컬·테스트 전용 데이터 여부',
  started_at TIMESTAMP(6) NULL COMMENT '첫 허용 turn 시작 시각',
  completed_at TIMESTAMP(6) NULL COMMENT '토론 완료 시각',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Run 생성 시각',
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6) COMMENT 'Run 최종 변경 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_discussion_runs_guide (guide_id),
  UNIQUE KEY uk_discussion_runs_window (window_id),
  KEY idx_discussion_runs_session (session_id),
  KEY idx_discussion_runs_user (user_id),
  KEY idx_discussion_runs_current_item (current_item_id),
  KEY idx_discussion_runs_test_data (is_test_data),
  CONSTRAINT fk_discussion_runs_guide
    FOREIGN KEY (guide_id) REFERENCES discussion_guides (id),
  CONSTRAINT fk_discussion_runs_window
    FOREIGN KEY (window_id) REFERENCES session_windows (id),
  CONSTRAINT fk_discussion_runs_session
    FOREIGN KEY (session_id) REFERENCES reading_sessions (id),
  CONSTRAINT fk_discussion_runs_user
    FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_discussion_runs_current_item
    FOREIGN KEY (current_item_id) REFERENCES discussion_guide_items (id),
  CONSTRAINT fk_discussion_runs_revision
    FOREIGN KEY (refined_revision_id) REFERENCES reflection_revisions (id),
  CONSTRAINT chk_discussion_runs_status
    CHECK (status IN ('READY', 'ACTIVE', 'COMPLETED', 'ABANDONED')),
  CONSTRAINT chk_discussion_runs_refinement
    CHECK (
      refinement_outcome IS NULL OR refinement_outcome IN (
        'DEEPENED',
        'NEW_PERSPECTIVE',
        'CHANGED',
        'KEPT'
      )
    ),
  CONSTRAINT chk_discussion_runs_director
    CHECK (
      last_director_action IS NULL OR last_director_action IN (
        'ASK_FOLLOW_UP',
        'CALL_PERSPECTIVE',
        'MOVE_NEXT_TOPIC',
        'SUMMARIZE_TOPIC',
        'FINISH_DISCUSSION'
      )
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='발제안 기반 Moderator·Director·Persona 토론 진행 상태';
