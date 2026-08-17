ALTER TABLE users
  ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' AFTER auth_provider,
  ADD COLUMN resigned_at TIMESTAMP NULL AFTER account_status,
  ADD COLUMN personal_data_purge_scheduled_at TIMESTAMP NULL AFTER resigned_at,
  ADD COLUMN personal_data_purged_at TIMESTAMP NULL AFTER personal_data_purge_scheduled_at,
  ADD COLUMN credentials_version BIGINT NOT NULL DEFAULT 1 AFTER personal_data_purged_at,
  ADD COLUMN erase_activity_on_purge BOOLEAN NOT NULL DEFAULT FALSE AFTER credentials_version,
  ADD KEY idx_users_account_purge (account_status, personal_data_purge_scheduled_at);

CREATE TABLE account_email_challenges (
  id CHAR(36) NOT NULL,
  user_id BIGINT NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  code_hmac CHAR(64) NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  used_at TIMESTAMP NULL,
  action_token_hash CHAR(64) NULL,
  action_token_expires_at TIMESTAMP NULL,
  request_ip_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_account_challenge_user_created (user_id, created_at),
  KEY idx_account_challenge_ip_created (request_ip_hash, created_at),
  KEY idx_account_challenge_expiry (expires_at),
  CONSTRAINT fk_account_challenge_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_lifecycle_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  transition_type VARCHAR(40) NOT NULL,
  result VARCHAR(20) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  purge_after TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_account_lifecycle_retention (processed_at),
  KEY idx_account_lifecycle_user (user_id),
  CONSTRAINT fk_account_lifecycle_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE anonymous_exit_surveys (
  id BIGINT NOT NULL AUTO_INCREMENT,
  reason_code VARCHAR(40) NOT NULL,
  gender_code VARCHAR(30) NULL,
  gender_text VARCHAR(80) NULL,
  age_band VARCHAR(20) NULL,
  country_code CHAR(2) NULL,
  region VARCHAR(120) NULL,
  other_text VARCHAR(500) NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_month DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exit_surveys_retention (created_at),
  KEY idx_exit_surveys_month_reason (created_month, reason_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE anonymous_exit_survey_monthly_aggregates (
  aggregate_month DATE NOT NULL,
  reason_code VARCHAR(40) NOT NULL,
  gender_code VARCHAR(30) NOT NULL DEFAULT '',
  age_band VARCHAR(20) NOT NULL DEFAULT '',
  country_code CHAR(2) NOT NULL DEFAULT '',
  response_count BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (aggregate_month, reason_code, gender_code, age_band, country_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
