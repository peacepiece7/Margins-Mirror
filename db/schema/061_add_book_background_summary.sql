ALTER TABLE books
  ADD COLUMN background_summary TEXT NULL COMMENT '독자 편집 배경 설명, NULL은 AI 원본 사용',
  ADD COLUMN background_revision INT NOT NULL DEFAULT 0 COMMENT '배경 설명 수정 버전',
  ADD COLUMN background_updated_at DATETIME NULL COMMENT '배경 설명 수정 시각';
