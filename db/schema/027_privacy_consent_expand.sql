-- 개인정보 동의 이력과 가입 전 pending record를 확장한다.
CREATE TABLE IF NOT EXISTS user_consent_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  consent_type VARCHAR(40) NOT NULL,
  document_version VARCHAR(20) NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  registration_channel VARCHAR(20) NOT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY idx_consent_user_type_time (user_id, consent_type, occurred_at, id),
  KEY idx_consent_test_data (is_test_data),
  CONSTRAINT fk_consent_events_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pending_registration_intents (
  token_hash CHAR(64) NOT NULL,
  privacy_policy_version VARCHAR(20) NOT NULL,
  ai_transfer_version VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_registration_intent_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pending_google_registrations (
  token_hash CHAR(64) NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  display_name VARCHAR(120) NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  UNIQUE KEY uk_pending_google_subject (provider_subject),
  KEY idx_pending_google_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 전화번호는 즉시 비가역 파기한다. rollback은 column 호환성만 복구하며 값을 복구하지 않는다.
UPDATE users SET phone_number = NULL WHERE phone_number IS NOT NULL;

SET @phone_index_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uk_users_phone_number'
);
SET @drop_phone_index = IF(
  @phone_index_exists > 0,
  'ALTER TABLE users DROP INDEX uk_users_phone_number',
  'DO 0'
);
PREPARE statement FROM @drop_phone_index;
EXECUTE statement;
DEALLOCATE PREPARE statement;
