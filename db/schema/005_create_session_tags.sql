CREATE TABLE IF NOT EXISTS session_tags (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  label VARCHAR(80) NOT NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_session_tags_session (session_id, deleted_at),
  KEY idx_session_tags_user_label (user_id, label),
  KEY idx_session_tags_test_data (is_test_data),
  CONSTRAINT fk_session_tags_session FOREIGN KEY (session_id) REFERENCES reading_sessions (id),
  CONSTRAINT fk_session_tags_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
