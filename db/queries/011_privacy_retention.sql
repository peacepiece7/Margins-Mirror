-- PrivacyRetentionService의 hourly purge 결과를 점검한다.
SELECT COUNT(*) AS overdue_registration_intent_count
FROM pending_registration_intents
WHERE COALESCE(used_at, expires_at) <= CURRENT_TIMESTAMP - INTERVAL 1 DAY;

SELECT COUNT(*) AS overdue_google_registration_count
FROM pending_google_registrations
WHERE COALESCE(used_at, expires_at) <= CURRENT_TIMESTAMP - INTERVAL 1 DAY;

SELECT id, email, expires_at, used_at, confirmed_at
FROM auth_email_verifications
WHERE GREATEST(
  expires_at,
  COALESCE(used_at, '1970-01-01'),
  COALESCE(confirmed_at, '1970-01-01')
) < CURRENT_TIMESTAMP - INTERVAL 1 DAY;

SELECT id, user_id, expires_at, revoked_at
FROM refresh_tokens
WHERE COALESCE(revoked_at, expires_at) < CURRENT_TIMESTAMP - INTERVAL 7 DAY;

SELECT id, user_id, consent_type, document_version, event_type, occurred_at
FROM user_consent_events
ORDER BY user_id, occurred_at, id;

SELECT COUNT(*) AS overdue_email_verification_count
FROM auth_email_verifications
WHERE expires_at <= CURRENT_TIMESTAMP - INTERVAL 1 DAY
  AND (used_at IS NULL OR used_at <= CURRENT_TIMESTAMP - INTERVAL 1 DAY)
  AND (confirmed_at IS NULL OR confirmed_at <= CURRENT_TIMESTAMP - INTERVAL 1 DAY);

SELECT COUNT(*) AS overdue_email_verification_rate_limit_count
FROM auth_email_verification_rate_limits
WHERE retention_after <= CURRENT_TIMESTAMP;

SELECT COUNT(*) AS overdue_refresh_token_count
FROM refresh_tokens
WHERE COALESCE(revoked_at, expires_at) <= CURRENT_TIMESTAMP - INTERVAL 7 DAY;

SELECT COUNT(*) AS overdue_login_lock_count
FROM users
WHERE locked_until IS NOT NULL
  AND locked_until <= CURRENT_TIMESTAMP - INTERVAL 7 DAY;

SELECT COUNT(*) AS overdue_lifecycle_event_count
FROM account_lifecycle_events
WHERE processed_at <= CURRENT_TIMESTAMP - INTERVAL 1 YEAR;

SELECT COUNT(*) AS overdue_exit_survey_count
FROM anonymous_exit_surveys
WHERE created_at <= CURRENT_TIMESTAMP - INTERVAL 1 YEAR;

SELECT COUNT(*) AS overdue_exit_survey_aggregate_count
FROM anonymous_exit_survey_monthly_aggregates
WHERE aggregate_month <= CURRENT_DATE - INTERVAL 3 YEAR;

SELECT COUNT(*) AS overdue_contact_inquiry_count
FROM contact_inquiries
WHERE delete_after <= CURRENT_TIMESTAMP;
