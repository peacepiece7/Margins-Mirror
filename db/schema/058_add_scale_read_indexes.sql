-- Library thread와 최근 activity의 owner-scoped latest-row 조회를 위한 additive index.
-- 기존 row와 API identity는 변경하지 않는다. 롤백은 각 index를 이름으로 제거한다.
ALTER TABLE reading_sessions
  ADD KEY idx_reading_sessions_book_owner_latest
    (book_id, user_id, deleted_at, updated_at DESC, id DESC);

ALTER TABLE session_insights
  ADD KEY idx_session_insights_session_owner_type_latest
    (session_id, user_id, insight_type, deleted_at, updated_at DESC, id DESC);

ALTER TABLE reflection_interviews
  ADD KEY idx_reflection_interviews_revision_owner_latest
    (source_revision_id, user_id, status, updated_at DESC, id DESC);

ALTER TABLE reflection_revisions
  ADD KEY idx_reflection_revisions_owner_activity
    (user_id, created_at DESC, id DESC);
