-- Memory Card 그룹을 선택한 서재 책에 선택적으로 연결한다.
-- 기존 전역 그룹은 NULL을 유지하며 backfill하거나 삭제하지 않는다.
ALTER TABLE memory_card_groups
  ADD COLUMN book_id BIGINT NULL COMMENT '연결 책 ID, NULL은 전역 그룹' AFTER user_id,
  ADD KEY idx_memory_card_groups_user_book (user_id, book_id, deleted_at, updated_at),
  ADD KEY idx_memory_card_groups_book (book_id),
  ADD CONSTRAINT fk_memory_card_groups_book
    FOREIGN KEY (book_id) REFERENCES books (id);
