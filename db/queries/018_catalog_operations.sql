-- 읽기 전용 catalog 운영 점검. 검색 원문/HMAC secret/API key/BLOB은 출력하지 않는다.
-- 일관된 counter 검증은 writer를 정지하거나 동일 consistent snapshot에서 수행한다.
SELECT b.used_bytes, b.limit_bytes,
       COALESCE((SELECT SUM(OCTET_LENGTH(image_bytes)) FROM catalog_cover_assets), 0) AS actual_bytes,
       b.used_bytes - COALESCE((SELECT SUM(OCTET_LENGTH(image_bytes)) FROM catalog_cover_assets), 0) AS drift_bytes
FROM catalog_storage_budget b WHERE b.id = 1;

SELECT code, adapter_type, status, metadata_policy, cover_policy,
       policy_version, policy_expires_at, requests_today, daily_request_limit,
       backoff_until, is_test_data
FROM catalog_sources ORDER BY is_test_data, priority, id;

SELECT kind, state, safe_error_code, is_test_data, COUNT(*) AS job_count
FROM catalog_crawl_jobs
GROUP BY kind, state, safe_error_code, is_test_data;

SELECT COUNT(*) AS overdue_raw_queries
FROM catalog_search_entries
WHERE query_text IS NOT NULL AND text_expires_at <= UTC_TIMESTAMP(6);

SELECT COUNT(*) AS overdue_snapshots
FROM catalog_search_snapshots WHERE expires_at <= UTC_TIMESTAMP(6);

SELECT COUNT(*) AS expired_source_payloads
FROM catalog_book_sources
WHERE normalized_payload IS NOT NULL AND expires_at <= UTC_TIMESTAMP(6);
