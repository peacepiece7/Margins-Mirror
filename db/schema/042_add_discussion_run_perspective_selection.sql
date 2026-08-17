-- Migration 042: persist only the bounded active Persona candidate IDs awaiting reader choice.

ALTER TABLE discussion_runs
  ADD COLUMN pending_perspective_item_id BIGINT NULL
    COMMENT 'Reader choice가 필요한 현재 Guide item 식별자' AFTER last_director_action,
  ADD COLUMN pending_perspective_ids_json JSON NULL
    COMMENT 'Director가 고른 active Persona ID 최대 2개; 원문·prompt·응답 미저장' AFTER pending_perspective_item_id,
  ADD KEY idx_discussion_runs_pending_perspective (pending_perspective_item_id),
  ADD CONSTRAINT fk_discussion_runs_pending_perspective_item
    FOREIGN KEY (pending_perspective_item_id) REFERENCES discussion_guide_items (id);
