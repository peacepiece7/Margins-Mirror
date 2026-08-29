CREATE TABLE IF NOT EXISTS user_memberships (
  user_id BIGINT NOT NULL,
  tier ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_user_memberships_active_tier (tier, expires_at),
  CONSTRAINT fk_user_memberships_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO user_memberships (
  user_id,
  tier,
  granted_at,
  expires_at
)
SELECT
  id,
  'PREMIUM',
  CURRENT_TIMESTAMP,
  NULL
FROM users
WHERE username = 'peacepiece'
  AND deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  tier = 'PREMIUM',
  granted_at = CURRENT_TIMESTAMP,
  expires_at = NULL;
