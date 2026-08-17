SET @failed_attempts_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_email_verifications'
    AND COLUMN_NAME = 'failed_attempts'
);

SET @failed_attempts_ddl = IF(
  @failed_attempts_exists = 0,
  'ALTER TABLE auth_email_verifications ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0 AFTER confirmed_at',
  'DO 0'
);

PREPARE statement FROM @failed_attempts_ddl;
EXECUTE statement;
DEALLOCATE PREPARE statement;

CREATE TABLE IF NOT EXISTS auth_email_verification_rate_limits (
  scope_type VARCHAR(16) NOT NULL,
  scope_hash CHAR(64) NOT NULL,
  minute_window_started_at TIMESTAMP NULL,
  minute_count INT NOT NULL DEFAULT 0,
  hour_window_started_at TIMESTAMP NULL,
  hour_count INT NOT NULL DEFAULT 0,
  day_window_started_at TIMESTAMP NULL,
  day_count INT NOT NULL DEFAULT 0,
  retention_after TIMESTAMP NOT NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (scope_type, scope_hash),
  KEY idx_auth_email_verification_rate_limits_retention (retention_after),
  KEY idx_auth_email_verification_rate_limits_test_data (is_test_data),
  CONSTRAINT chk_auth_email_verification_rate_limit_scope
    CHECK (scope_type IN ('EMAIL', 'IP')),
  CONSTRAINT chk_auth_email_verification_rate_limit_counts
    CHECK (minute_count >= 0 AND hour_count >= 0 AND day_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
