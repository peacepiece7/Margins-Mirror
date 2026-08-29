-- 공개 문의와 운영자 메일 전달 상태 보존.
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '문의 식별자',
  email VARCHAR(254) NOT NULL COMMENT '답변 수신 이메일',
  category VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '문의 분류',
  subject VARCHAR(160) NOT NULL COMMENT '문의 제목',
  message TEXT NOT NULL COMMENT '문의 내용',
  status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING_DELIVERY' COMMENT '메일 전달 및 처리 상태',
  provider_message_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '메일 provider 수락 식별자',
  delivery_failure_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '본문 없는 전달 실패 분류',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '문의 수신 시각',
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '상태 갱신 시각',
  closed_at TIMESTAMP(6) NULL COMMENT '운영 처리 완료 시각',
  delete_after TIMESTAMP(6) NOT NULL COMMENT '수신 후 최대 1년 파기 시각',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 전용 데이터 여부',
  PRIMARY KEY (id),
  UNIQUE KEY uk_contact_inquiries_provider_message_id (provider_message_id),
  KEY idx_contact_inquiries_status_created (status, created_at),
  KEY idx_contact_inquiries_delete_after (delete_after),
  KEY idx_contact_inquiries_test_data (is_test_data),
  CONSTRAINT chk_contact_inquiries_category CHECK (category IN (
    'SERVICE_USAGE',
    'ACCOUNT_LOGIN',
    'PRIVACY',
    'BUG_REPORT',
    'FEATURE_REQUEST',
    'OTHER'
  )),
  CONSTRAINT chk_contact_inquiries_status CHECK (status IN (
    'PENDING_DELIVERY',
    'OPEN',
    'DELIVERY_FAILED',
    'CLOSED'
  )),
  CONSTRAINT chk_contact_inquiries_email CHECK (CHAR_LENGTH(TRIM(email)) BETWEEN 1 AND 254),
  CONSTRAINT chk_contact_inquiries_subject CHECK (CHAR_LENGTH(TRIM(subject)) BETWEEN 1 AND 160),
  CONSTRAINT chk_contact_inquiries_message CHECK (CHAR_LENGTH(TRIM(message)) BETWEEN 1 AND 5000),
  CONSTRAINT chk_contact_inquiries_delivery_state CHECK (
    (status = 'PENDING_DELIVERY' AND provider_message_id IS NULL AND delivery_failure_code IS NULL AND closed_at IS NULL)
    OR (status = 'OPEN' AND provider_message_id IS NOT NULL AND delivery_failure_code IS NULL AND closed_at IS NULL)
    OR (status = 'DELIVERY_FAILED' AND provider_message_id IS NULL AND delivery_failure_code IS NOT NULL AND closed_at IS NULL)
    OR (status = 'CLOSED' AND provider_message_id IS NOT NULL AND delivery_failure_code IS NULL AND closed_at IS NOT NULL)
  ),
  CONSTRAINT chk_contact_inquiries_delete_after CHECK (delete_after > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='공개 문의와 운영 전달 상태';
