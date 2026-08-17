ALTER TABLE session_insights
  ADD COLUMN question_id BIGINT NULL AFTER user_id,
  ADD COLUMN active_question_id BIGINT
    GENERATED ALWAYS AS (
      CASE WHEN deleted_at IS NULL THEN question_id ELSE NULL END
    ) STORED,
  ADD KEY idx_session_insights_question (question_id),
  ADD UNIQUE KEY uk_session_insights_active_question (active_question_id),
  ADD CONSTRAINT fk_session_insights_question
    FOREIGN KEY (question_id) REFERENCES questions (id);

ALTER TABLE session_windows
  ADD COLUMN source_question_id BIGINT NULL AFTER user_id,
  ADD COLUMN active_source_question_id BIGINT
    GENERATED ALWAYS AS (
      CASE
        WHEN deleted_at IS NULL AND window_type = 'debate' THEN source_question_id
        ELSE NULL
      END
    ) STORED,
  ADD KEY idx_session_windows_source_question (source_question_id),
  ADD UNIQUE KEY uk_session_windows_active_source_question (active_source_question_id),
  ADD CONSTRAINT fk_session_windows_source_question
    FOREIGN KEY (source_question_id) REFERENCES questions (id);

INSERT INTO session_insights (
  session_id,
  user_id,
  question_id,
  insight_type,
  title,
  content,
  visibility,
  insight_order,
  is_test_data,
  created_at,
  updated_at
)
SELECT
  legacy.session_id,
  legacy.user_id,
  legacy.question_id,
  'question_answer',
  NULL,
  legacy.content,
  'PRIVATE',
  legacy.base_order + legacy.answer_order,
  legacy.is_test_data,
  legacy.created_at,
  legacy.updated_at
FROM (
  SELECT
    q.session_id,
    q.user_id,
    q.id AS question_id,
    m.content,
    m.is_test_data,
    m.created_at,
    m.updated_at,
    COALESCE((
      SELECT MAX(existing.insight_order)
      FROM session_insights existing
      WHERE existing.session_id = q.session_id
        AND existing.deleted_at IS NULL
    ), 0) AS base_order,
    ROW_NUMBER() OVER (PARTITION BY q.session_id ORDER BY q.id) AS answer_order
  FROM questions q
  INNER JOIN messages m ON m.id = (
    SELECT latest.id
    FROM messages latest
    WHERE latest.question_id = q.id
      AND latest.role = 'user'
      AND latest.deleted_at IS NULL
    ORDER BY latest.message_order DESC, latest.id DESC
    LIMIT 1
  )
  WHERE q.deleted_at IS NULL
) legacy;
