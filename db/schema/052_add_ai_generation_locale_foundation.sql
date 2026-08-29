-- AI 생성 결과의 언어 provenance를 신규 row에만 기록한다. 기존 데이터는 backfill하지 않는다.
ALTER TABLE ai_generation_events
  ADD COLUMN generation_locale VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '생성 시점 계정 locale (ko|en)',
  ADD COLUMN language_validation_outcome VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '언어 검증 결과',
  ADD CONSTRAINT chk_ai_generation_events_locale CHECK (generation_locale IS NULL OR generation_locale IN ('ko', 'en')),
  ADD CONSTRAINT chk_ai_generation_events_language_validation CHECK (language_validation_outcome IS NULL OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN'));

ALTER TABLE messages
  ADD COLUMN generation_locale VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 생성 시점 계정 locale (ko|en)',
  ADD COLUMN language_validation_outcome VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 언어 검증 결과',
  ADD CONSTRAINT chk_messages_generation_locale CHECK (generation_locale IS NULL OR generation_locale IN ('ko', 'en')),
  ADD CONSTRAINT chk_messages_language_validation CHECK (language_validation_outcome IS NULL OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN'));

ALTER TABLE questions
  ADD COLUMN generation_locale VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 생성 시점 계정 locale (ko|en)',
  ADD COLUMN language_validation_outcome VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 언어 검증 결과',
  ADD CONSTRAINT chk_questions_generation_locale CHECK (generation_locale IS NULL OR generation_locale IN ('ko', 'en')),
  ADD CONSTRAINT chk_questions_language_validation CHECK (language_validation_outcome IS NULL OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN'));

ALTER TABLE discussion_guides
  ADD COLUMN generation_locale VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 생성 시점 계정 locale (ko|en)',
  ADD COLUMN language_validation_outcome VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 언어 검증 결과',
  ADD CONSTRAINT chk_discussion_guides_generation_locale CHECK (generation_locale IS NULL OR generation_locale IN ('ko', 'en')),
  ADD CONSTRAINT chk_discussion_guides_language_validation CHECK (language_validation_outcome IS NULL OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN'));

ALTER TABLE moderation_events
  ADD COLUMN generation_locale VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 생성 시점 계정 locale (ko|en)',
  ADD COLUMN language_validation_outcome VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'AI 언어 검증 결과',
  ADD CONSTRAINT chk_moderation_events_generation_locale CHECK (generation_locale IS NULL OR generation_locale IN ('ko', 'en')),
  ADD CONSTRAINT chk_moderation_events_language_validation CHECK (language_validation_outcome IS NULL OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN'));
