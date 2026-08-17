CREATE TABLE IF NOT EXISTS memory_card_groups (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  source_label VARCHAR(255) NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_memory_card_groups_user (user_id, deleted_at, updated_at),
  KEY idx_memory_card_groups_test_data (is_test_data),
  CONSTRAINT fk_memory_card_groups_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS memory_cards (
  id BIGINT NOT NULL AUTO_INCREMENT,
  group_id BIGINT NOT NULL,
  front_text VARCHAR(200) NOT NULL,
  back_text VARCHAR(500) NOT NULL,
  example_text VARCHAR(1000) NULL,
  memo VARCHAR(1000) NULL,
  position INT NOT NULL DEFAULT 0,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_memory_cards_group_position (group_id, deleted_at, position, id),
  KEY idx_memory_cards_test_data (is_test_data),
  CONSTRAINT fk_memory_cards_group FOREIGN KEY (group_id) REFERENCES memory_card_groups (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
