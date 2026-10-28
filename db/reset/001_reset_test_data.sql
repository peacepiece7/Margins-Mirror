-- 목적: production-owned record는 건드리지 않고 deterministic test-owned row를 제거한 뒤 local/E2E data를 다시 seed한다.
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
UPDATE catalog_search_entries SET generation=generation WHERE is_test_data=TRUE;
SELECT used_bytes FROM catalog_storage_budget WHERE id=1 FOR UPDATE;
UPDATE books SET catalog_book_id=NULL WHERE catalog_book_id IN (SELECT id FROM catalog_books WHERE is_test_data=TRUE);
UPDATE books SET cover_image_url=NULL WHERE cover_image_url IN (SELECT CONCAT('/api/catalog/covers/',id,'/',LOWER(HEX(sha256))) FROM catalog_cover_assets WHERE is_test_data=TRUE);
UPDATE catalog_books SET cover_asset_id=NULL WHERE cover_asset_id IN (SELECT id FROM catalog_cover_assets WHERE is_test_data=TRUE);
DELETE FROM catalog_crawl_jobs WHERE is_test_data=TRUE;
DELETE FROM catalog_search_snapshot_items WHERE is_test_data=TRUE;
DELETE FROM catalog_search_hits WHERE is_test_data=TRUE;
DELETE FROM catalog_search_source_runs WHERE is_test_data=TRUE;
DELETE FROM catalog_search_snapshots WHERE is_test_data=TRUE;
DELETE FROM catalog_search_entries WHERE is_test_data=TRUE;
UPDATE catalog_storage_budget SET used_bytes=used_bytes-(SELECT COALESCE(SUM(OCTET_LENGTH(image_bytes)),0) FROM catalog_cover_assets WHERE is_test_data=TRUE) WHERE id=1;
DELETE FROM catalog_cover_assets WHERE is_test_data=TRUE;
DELETE FROM catalog_book_sources WHERE is_test_data=TRUE;
DELETE FROM catalog_books WHERE is_test_data=TRUE;
COMMIT;

DELETE FROM contact_inquiries WHERE is_test_data = TRUE;
DELETE FROM pending_google_registrations WHERE is_test_data = TRUE;
DELETE FROM pending_registration_intents WHERE is_test_data = TRUE;
DELETE FROM auth_email_verification_rate_limits WHERE is_test_data = TRUE;
DELETE FROM auth_email_verifications WHERE is_test_data = TRUE;
DELETE FROM user_consent_events WHERE is_test_data = TRUE;
DELETE FROM anonymous_exit_surveys WHERE is_test_data = TRUE;
DELETE c FROM account_email_challenges c
JOIN users u ON u.id = c.user_id
WHERE u.is_test_data = TRUE;
DELETE e FROM account_lifecycle_events e
JOIN users u ON u.id = e.user_id
WHERE u.is_test_data = TRUE;

DELETE FROM ai_generation_events WHERE is_test_data = TRUE;
DELETE FROM moderation_events WHERE is_test_data = TRUE;
DELETE FROM moderation_daily_aggregates WHERE is_test_data = TRUE;
DELETE FROM metrics WHERE is_test_data = TRUE;
DELETE FROM book_knowledge WHERE is_test_data = TRUE;
DELETE FROM memory_cards WHERE is_test_data = TRUE;
DELETE FROM memory_card_groups WHERE is_test_data = TRUE;
DELETE FROM discussion_run_refinements WHERE is_test_data = TRUE;
DELETE FROM reflection_summaries WHERE is_test_data = TRUE;
DELETE FROM discussion_runs WHERE is_test_data = TRUE;
DELETE FROM discussion_guide_items WHERE is_test_data = TRUE;
DELETE FROM discussion_guides WHERE is_test_data = TRUE;
DELETE FROM reflection_interview_answer_revisions WHERE is_test_data = TRUE;
DELETE FROM messages WHERE is_test_data = TRUE;
DELETE FROM session_window_personas WHERE window_id IN (SELECT id FROM session_windows WHERE is_test_data = TRUE);
DELETE FROM review_comments WHERE is_test_data = TRUE;
DELETE FROM session_tags WHERE is_test_data = TRUE;
DELETE FROM session_highlights WHERE is_test_data = TRUE;
DELETE FROM questions WHERE is_test_data = TRUE;
DELETE FROM reflection_interviews WHERE is_test_data = TRUE;
DELETE FROM reflection_revisions WHERE is_test_data = TRUE;
DELETE FROM session_insights WHERE is_test_data = TRUE;
DELETE FROM personas WHERE is_test_data = TRUE;
DELETE FROM session_windows WHERE is_test_data = TRUE;
DELETE FROM reading_sessions WHERE is_test_data = TRUE;
DELETE FROM book_candidates WHERE is_test_data = TRUE;
DELETE FROM books WHERE is_test_data = TRUE;
DELETE oi FROM user_oauth_identities oi
JOIN users u ON u.id = oi.user_id
WHERE u.is_test_data = TRUE;
DELETE FROM users WHERE is_test_data = TRUE;

SET FOREIGN_KEY_CHECKS = 1;

SOURCE db/seed/001_seed_mvp_data.sql;
