-- 목적: Google OAuth rollout 전후 provider identity와 owning user 상태를 점검한다.
-- 조회 전용이며 local/test reset이나 production data를 변경하지 않는다.

SELECT
  oi.id AS identity_id,
  oi.user_id,
  u.username,
  u.display_name,
  u.email,
  u.email_verified,
  u.last_login_at,
  oi.provider,
  oi.provider_subject,
  oi.provider_email,
  oi.linked_at,
  oi.created_at,
  oi.updated_at
FROM user_oauth_identities oi
JOIN users u ON u.id = oi.user_id AND u.deleted_at IS NULL
WHERE oi.provider_subject IS NOT NULL
ORDER BY oi.updated_at DESC, oi.id DESC;

SELECT
  LOWER(TRIM(COALESCE(u.email, oi.provider_email))) AS verified_email_key,
  COUNT(*) AS identity_count,
  COUNT(DISTINCT oi.provider) AS provider_count,
  GROUP_CONCAT(DISTINCT oi.provider ORDER BY oi.provider) AS providers,
  GROUP_CONCAT(DISTINCT u.id ORDER BY u.id) AS user_ids
FROM user_oauth_identities oi
JOIN users u ON u.id = oi.user_id AND u.deleted_at IS NULL
WHERE u.email_verified = TRUE
  AND COALESCE(u.email, oi.provider_email) IS NOT NULL
GROUP BY LOWER(TRIM(COALESCE(u.email, oi.provider_email)))
HAVING COUNT(*) > 1
ORDER BY identity_count DESC, verified_email_key;
