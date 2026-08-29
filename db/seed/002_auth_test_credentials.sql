-- 목적: test login account가 최신 auth field와 local verification용 known password hash를 갖도록 보장한다.
INSERT INTO users (id, username, display_name, email, email_verified, password_hash, auth_provider, is_test_data)
VALUES (
  1,
  'peacepiece',
  'peacepiece',
  'peacepiece@test.margins.local',
  TRUE,
  '$2b$12$x0GhNoH36hSY1OcS4EdDd.Nc8sm8B3mvPfBPr6aOFspYF2nqYtAhy',
  'local',
  TRUE
)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  display_name = VALUES(display_name),
  email = VALUES(email),
  email_verified = VALUES(email_verified),
  password_hash = VALUES(password_hash),
  auth_provider = VALUES(auth_provider),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

-- 목적: 회원정보 수정, 비밀번호 변경, 회원탈퇴 등 계정 생명주기 전체 플로우를
-- 기존 독서 데이터 시드와 분리된 계정으로 검증할 수 있게 한다.
INSERT INTO users (username, display_name, email, email_verified, password_hash, auth_provider, is_test_data)
VALUES (
  'account_tester',
  'Account Tester',
  'account_tester@test.margins.local',
  TRUE,
  '$2b$12$x0GhNoH36hSY1OcS4EdDd.Nc8sm8B3mvPfBPr6aOFspYF2nqYtAhy',
  'local',
  TRUE
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  email = VALUES(email),
  email_verified = VALUES(email_verified),
  password_hash = VALUES(password_hash),
  auth_provider = VALUES(auth_provider),
  account_status = 'ACTIVE',
  resigned_at = NULL,
  personal_data_purge_scheduled_at = NULL,
  personal_data_purged_at = NULL,
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

-- standalone auth seed도 privacy enforcement 활성화 상태에서 정상 fixture가 되도록 현재 동의를 보장한다.
INSERT INTO user_consent_events (
  user_id, consent_type, document_version, event_type, registration_channel, is_test_data
)
SELECT u.id, required.consent_type, '2026-07-27', 'GRANTED', 'SEED', TRUE
FROM users u
CROSS JOIN (
  SELECT 'PRIVACY_POLICY' AS consent_type
  UNION ALL SELECT 'OPENAI_OVERSEAS_TRANSFER'
  UNION ALL SELECT 'AGE_OVER_14'
) required
WHERE u.username IN ('peacepiece', 'account_tester')
  AND u.is_test_data = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM user_consent_events latest
    WHERE latest.user_id = u.id
      AND latest.consent_type = required.consent_type
      AND latest.id = (
        SELECT MAX(previous.id)
        FROM user_consent_events previous
        WHERE previous.user_id = u.id
          AND previous.consent_type = required.consent_type
      )
      AND latest.document_version = '2026-07-27'
      AND latest.event_type = 'GRANTED'
  );
