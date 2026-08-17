CREATE TABLE IF NOT EXISTS review_comments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  insight_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  parent_comment_id BIGINT NULL,
  content TEXT NOT NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_review_comments_insight_parent (insight_id, parent_comment_id, created_at, id),
  KEY idx_review_comments_user (user_id),
  KEY idx_review_comments_parent (parent_comment_id),
  KEY idx_review_comments_test_data (is_test_data),
  CONSTRAINT fk_review_comments_insight FOREIGN KEY (insight_id) REFERENCES session_insights (id),
  CONSTRAINT fk_review_comments_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_review_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES review_comments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
