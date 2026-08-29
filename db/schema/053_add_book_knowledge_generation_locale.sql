-- Book Knowledge 재사용·claim 정체성을 계정 생성 언어별로 분리한다.
-- 기존 row는 locale을 backfill하지 않고 보존하며 ko/en 요청에서 재사용하지 않는다.
ALTER TABLE book_knowledge
  ADD COLUMN generation_locale VARCHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL
    COMMENT '생성 시점 계정 locale(ko|en), legacy row는 NULL' AFTER prompt_version,
  ADD COLUMN language_validation_outcome VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL
    COMMENT 'MATCH·KNOWN_MISMATCH·UNKNOWN, legacy/fallback 미판정은 NULL' AFTER generation_locale,
  DROP INDEX uk_book_knowledge_lookup_version_status,
  ADD UNIQUE KEY uk_book_knowledge_lookup_version_locale_status (
    lookup_key_type,
    lookup_key,
    prompt_version,
    generation_locale,
    status
  ),
  DROP INDEX idx_book_knowledge_claim,
  ADD KEY idx_book_knowledge_claim (
    lookup_key_type,
    lookup_key,
    prompt_version,
    generation_locale,
    generation_claimed_at
  ),
  ADD CONSTRAINT chk_book_knowledge_generation_locale
    CHECK (generation_locale IS NULL OR generation_locale IN ('ko', 'en')),
  ADD CONSTRAINT chk_book_knowledge_language_validation
    CHECK (
      language_validation_outcome IS NULL
      OR language_validation_outcome IN ('MATCH', 'KNOWN_MISMATCH', 'UNKNOWN')
    );
