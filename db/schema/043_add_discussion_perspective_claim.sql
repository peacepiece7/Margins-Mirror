-- Migration 043: prevent duplicate Persona selection calls while keeping provider work outside transactions.

ALTER TABLE discussion_runs
  ADD COLUMN pending_perspective_claim_token CHAR(36) NULL
    COMMENT '선택 중인 Persona 호출의 opaque lease token' AFTER pending_perspective_ids_json,
  ADD COLUMN pending_perspective_claimed_at TIMESTAMP(6) NULL
    COMMENT 'Persona 선택 lease 시작 시각' AFTER pending_perspective_claim_token,
  ADD KEY idx_discussion_runs_perspective_claim (
    pending_perspective_claim_token,
    pending_perspective_claimed_at
  );
