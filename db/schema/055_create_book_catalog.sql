-- 사용자 검색 기반 공용 카탈로그,30일 재조회 제한과 DB 표지10GB 예산.
CREATE TABLE catalog_sources (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '수집처 ID',
  code VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '수집처 고유 코드',
  display_name VARCHAR(120) NOT NULL COMMENT '출처 표시명',
  adapter_type VARCHAR(16) NOT NULL COMMENT 'API 또는 HTML',
  status VARCHAR(16) NOT NULL DEFAULT 'DISABLED' COMMENT 'DISABLED ACTIVE PAUSED REVOKED',
  metadata_policy VARCHAR(16) NOT NULL DEFAULT 'UNREVIEWED' COMMENT 'UNREVIEWED ALLOWED DENIED',
  cover_policy VARCHAR(16) NOT NULL DEFAULT 'UNREVIEWED' COMMENT 'UNREVIEWED ALLOWED DENIED',
  policy_reference VARCHAR(1000) NULL COMMENT '승인 문서 또는 계약 참조',
  policy_version INT NOT NULL DEFAULT 1 COMMENT '정책 버전',
  approved_fields JSON NULL COMMENT '저장 허용 필드 목록',
  metadata_ttl_seconds INT NULL COMMENT '보관 TTL NULL은 명시적 무기한 허용',
  cover_ttl_seconds INT NULL COMMENT '표지 보관 TTL NULL은 명시적 무기한 허용',
  policy_expires_at DATETIME(6) NULL COMMENT '승인 만료 시각 NULL은 명시적 무기한 승인',
  priority INT NOT NULL DEFAULT 100 COMMENT '필드 선택 우선순위 낮을수록 우선',
  min_interval_ms INT NOT NULL DEFAULT 1000 COMMENT '전체 worker 공유 최소 요청 간격',
  daily_request_limit INT NOT NULL DEFAULT 500 COMMENT 'source 전체 일별 내부 요청 상한',
  quota_date DATE NULL COMMENT 'UTC 호출 집계일',
  requests_today INT NOT NULL DEFAULT 0 COMMENT '예약된 오늘 호출 수',
  next_request_at DATETIME(6) NULL COMMENT '다음 외부 요청 허용 시각',
  backoff_until DATETIME(6) NULL COMMENT '일시 차단 종료 시각',
  consecutive_failures INT NOT NULL DEFAULT 0 COMMENT '연속 실패 수',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_source_code (code, is_test_data),
  CHECK (adapter_type IN ('API','HTML')),
  CHECK (status IN ('DISABLED','ACTIVE','PAUSED','REVOKED')),
  CHECK (metadata_policy IN ('UNREVIEWED','ALLOWED','DENIED')),
  CHECK (cover_policy IN ('UNREVIEWED','ALLOWED','DENIED')),
  CHECK (min_interval_ms > 0 AND daily_request_limit > 0),
  CHECK (metadata_ttl_seconds IS NULL OR metadata_ttl_seconds > 0),
  CHECK (cover_ttl_seconds IS NULL OR cover_ttl_seconds > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='카탈로그 수집처 정책';

CREATE TABLE catalog_books (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '공용 판본 ID',
  isbn13 CHAR(13) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '체크섬 검증 ISBN13 NULL은 미확인',
  title VARCHAR(255) NOT NULL COMMENT '표시 제목',
  subtitle VARCHAR(255) NULL COMMENT '부제',
  authors_display VARCHAR(255) NOT NULL COMMENT '표시 저자 목록',
  title_normalized VARCHAR(255) NOT NULL COMMENT '검색용 정규화 제목',
  authors_normalized VARCHAR(255) NOT NULL COMMENT '검색용 정규화 저자 목록',
  publisher VARCHAR(255) NULL COMMENT '출판사',
  published_date_text VARCHAR(10) NULL COMMENT '원천 정밀도 보존 YYYY YYYY-MM YYYY-MM-DD',
  language_code VARCHAR(16) NULL COMMENT '언어 코드',
  format VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN' COMMENT 'PRINT EBOOK AUDIOBOOK UNKNOWN',
  page_count INT NULL COMMENT '제공된 페이지 수',
  description TEXT NULL COMMENT '허용된 짧은 소개 최대 2000자',
  field_provenance JSON NOT NULL COMMENT '필드별 source record ID 및 정책 버전',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE HIDDEN CONFLICT',
  cover_asset_id BIGINT NULL COMMENT '현재 허용된 대표 표지 ID',
  metadata_checked_at DATETIME(6) NOT NULL COMMENT '서지정보 마지막 확인 시각',
  expires_at DATETIME(6) NULL COMMENT '현재 projection의 가장 이른 권리 만료',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_isbn (isbn13, is_test_data),
  KEY idx_catalog_title (title_normalized, id),
  KEY idx_catalog_author (authors_normalized, id),
  KEY idx_catalog_refresh (status, metadata_checked_at, id),
  KEY idx_catalog_expiry (expires_at, id),
  FULLTEXT KEY ft_catalog_title_authors (title_normalized, authors_normalized) WITH PARSER ngram,
  CHECK (format IN ('PRINT','EBOOK','AUDIOBOOK','UNKNOWN')),
  CHECK (status IN ('ACTIVE','HIDDEN','CONFLICT')),
  CHECK (page_count IS NULL OR page_count > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='공용 도서 판본 카탈로그';

CREATE TABLE catalog_book_sources (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '판본 원천 레코드 ID',
  catalog_book_id BIGINT NOT NULL COMMENT '공용 판본 ID',
  source_id BIGINT NOT NULL COMMENT '수집처 ID',
  external_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'source 내 대소문자 구분 ID',
  source_url VARCHAR(1000) NOT NULL COMMENT '검증된 출처 링크',
  source_kind VARCHAR(16) NOT NULL DEFAULT 'EDITION' COMMENT 'EDITION 또는 WORK',
  normalized_payload JSON NULL COMMENT '허용된 서지 필드와 contributors 및 식별자',
  payload_sha256 BINARY(32) NULL COMMENT '정규화 payload SHA256',
  parser_version VARCHAR(40) NOT NULL COMMENT 'adapter 파서 버전',
  policy_version INT NOT NULL COMMENT '저장 시 source 정책 버전',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE CONFLICT WITHDRAWN EXPIRED',
  cover_status VARCHAR(16) NOT NULL DEFAULT 'MISSING' COMMENT 'MISSING PENDING READY FAILED DENIED',
  metadata_etag VARCHAR(255) NULL COMMENT 'HTTP 조건부 조회 ETag',
  metadata_last_modified VARCHAR(80) NULL COMMENT 'HTTP Last-Modified 값',
  fetched_at DATETIME(6) NOT NULL COMMENT '마지막 성공 조회 시각',
  expires_at DATETIME(6) NULL COMMENT 'source별 metadata 이용 만료',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_source_record (source_id, external_id, is_test_data),
  KEY idx_catalog_source_book (catalog_book_id, status, source_id),
  KEY idx_catalog_source_expiry (expires_at, id),
  CONSTRAINT fk_catalog_record_book FOREIGN KEY (catalog_book_id) REFERENCES catalog_books(id),
  CONSTRAINT fk_catalog_record_source FOREIGN KEY (source_id) REFERENCES catalog_sources(id),
  CHECK (source_kind IN ('EDITION','WORK')),
  CHECK (status IN ('ACTIVE','CONFLICT','WITHDRAWN','EXPIRED')),
  CHECK (cover_status IN ('MISSING','PENDING','READY','FAILED','DENIED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='판본별 원천과 사용 근거';

CREATE TABLE catalog_cover_assets (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '표지 자산 ID',
  source_record_id BIGINT NOT NULL COMMENT '이미지 제공 원천 ID',
  sha256 BINARY(32) NOT NULL COMMENT '변환 후 이미지 bytes SHA256',
  source_url VARCHAR(1000) NULL COMMENT '내부 조회용 원본 이미지 URL',
  mime_type VARCHAR(32) NOT NULL COMMENT 'image/jpeg 또는 image/png',
  width SMALLINT UNSIGNED NOT NULL COMMENT '변환 후 폭',
  height SMALLINT UNSIGNED NOT NULL COMMENT '변환 후 높이',
  byte_size INT UNSIGNED NOT NULL COMMENT '바이너리 길이',
  image_bytes BLOB NULL COMMENT '최대 32 KiB 압축 표지 바이너리 철회 시 NULL',
  policy_version INT NOT NULL COMMENT '저장 시 정책 버전',
  status VARCHAR(16) NOT NULL DEFAULT 'READY' COMMENT 'READY WITHDRAWN EXPIRED',
  fetched_at DATETIME(6) NOT NULL COMMENT '마지막 허용된 확인 시각',
  expires_at DATETIME(6) NULL COMMENT '권리 또는 저장 TTL 만료',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_cover_content (source_record_id, sha256, is_test_data),
  KEY idx_catalog_cover_expiry (status, expires_at, id),
  CONSTRAINT fk_catalog_cover_record FOREIGN KEY (source_record_id) REFERENCES catalog_book_sources(id),
  CHECK (mime_type IN ('image/jpeg','image/png')),
  CHECK (width BETWEEN 1 AND 160 AND height BETWEEN 1 AND 240),
  CHECK (status IN ('READY','WITHDRAWN','EXPIRED')),
  CHECK (
    (status = 'READY' AND image_bytes IS NOT NULL
      AND byte_size BETWEEN 1 AND 32768 AND OCTET_LENGTH(image_bytes) = byte_size)
    OR (status IN ('WITHDRAWN','EXPIRED') AND image_bytes IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='DB 직접 저장 도서 표지';

ALTER TABLE catalog_books ADD CONSTRAINT fk_catalog_book_cover
  FOREIGN KEY (cover_asset_id) REFERENCES catalog_cover_assets(id);

CREATE TABLE catalog_storage_budget (
  id TINYINT UNSIGNED NOT NULL COMMENT '항상 1인 singleton',
  limit_bytes BIGINT UNSIGNED NOT NULL DEFAULT 10000000000 COMMENT '10 GB decimal',
  used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '현재 모든 image_bytes의 OCTET_LENGTH 합',
  query_hmac_key BINARY(32) NOT NULL COMMENT 'DB 생성 안정적 검색어 HMAC 키 응답 노출 금지',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '공유 예산은 test reset 대상 아님',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '마지막 계수 변경',
  PRIMARY KEY (id),
  CHECK (id = 1 AND is_test_data = FALSE),
  CHECK (limit_bytes = 10000000000 AND used_bytes <= limit_bytes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='DB 이미지 10GB 저장 예산';

CREATE TABLE catalog_search_entries (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '30일 공용 검색 cache ID',
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '수집 상태 조회용 무작위 UUID',
  query_key BINARY(32) NOT NULL COMMENT '정규화 keyword HMAC SHA256 필터/사용자 제외',
  key_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'HMAC secret/정규화 규칙 버전',
  query_text VARCHAR(200) NULL COMMENT 'worker용 검색어 최대 24시간 후 NULL',
  text_expires_at DATETIME(6) NULL COMMENT '이번 세대 query_text 최대 수명',
  generation INT NOT NULL DEFAULT 0 COMMENT '사용자 제출이 만든 수집 세대 fencing',
  result_version INT NOT NULL DEFAULT 0 COMMENT 'source 결과 반영 시 증가하는 공개 버전',
  last_outcome VARCHAR(16) NOT NULL DEFAULT 'NONE' COMMENT 'NONE SUCCEEDED PARTIAL FAILED DEFERRED',
  last_collected_at DATETIME(6) NULL COMMENT '정상 결과/정상 EMPTY/usable PARTIAL 완료 시각',
  revalidate_after DATETIME(6) NULL COMMENT '마지막 유효 수집 완료+30일 NULL은 성공 수집 없음',
  retry_after DATETIME(6) NULL COMMENT '실패/보류 후 다음 사용자 재시도 가능 시각',
  cached_book_ids JSON NOT NULL COMMENT '30일 재사용할 최대 200개 catalogBookId',
  source_outcomes JSON NOT NULL COMMENT 'source별 outcome/결과수/계획 범위 원문 검색어 없음',
  retire_after DATETIME(6) NOT NULL COMMENT '재조회 제한이 끝난 뒤 정리 가능 시각',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_query (query_key, is_test_data),
  UNIQUE KEY uk_catalog_collection_public (public_id),
  KEY idx_catalog_query_text_expiry (text_expires_at, id),
  KEY idx_catalog_query_retire (retire_after, id),
  CHECK (last_outcome IN ('NONE','SUCCEEDED','PARTIAL','FAILED','DEFERRED')),
  CHECK (JSON_TYPE(cached_book_ids) = 'ARRAY' AND JSON_LENGTH(cached_book_ids) <= 200),
  CHECK (
    (last_collected_at IS NULL AND revalidate_after IS NULL)
    OR (last_collected_at IS NOT NULL AND revalidate_after IS NOT NULL
      AND revalidate_after = TIMESTAMPADD(DAY, 30, last_collected_at))
  ),
  CHECK (revalidate_after IS NULL OR retire_after >= revalidate_after),
  CHECK ((query_text IS NULL) OR text_expires_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='30일 keyword 수집 결과와 재조회 제한';

CREATE TABLE catalog_search_snapshots (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'snapshot 내부 ID',
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'page 조회용 무작위 UUID',
  query_entry_id BIGINT NOT NULL COMMENT '공용 query cache ID',
  generation INT NOT NULL COMMENT '수집 세대',
  result_version INT NOT NULL COMMENT 'snapshot 생성 시 source 결과 버전',
  query_field VARCHAR(16) NOT NULL DEFAULT 'ALL' COMMENT '화면 검색 범위 ALL TITLE AUTHOR ISBN',
  language_filter VARCHAR(16) NOT NULL DEFAULT 'ALL' COMMENT '화면 언어 ALL ko en',
  format_filter VARCHAR(16) NOT NULL DEFAULT 'ALL' COMMENT '화면 형식 ALL PRINT EBOOK AUDIOBOOK',
  ranking_version VARCHAR(40) NOT NULL COMMENT '로컬 정렬 버전 외부 수집 key 아님',
  ranked_books JSON NOT NULL COMMENT '최대 200개 catalogBookId score 정렬 배열',
  truncated BOOLEAN NOT NULL DEFAULT FALSE COMMENT '상한 또는 source budget 도달',
  expires_at DATETIME(6) NOT NULL COMMENT '생성 후 15분 만료',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_snapshot_public (public_id),
  KEY idx_catalog_snapshot_query (query_entry_id, generation, result_version, id),
  KEY idx_catalog_snapshot_expiry (expires_at, id),
  CONSTRAINT fk_catalog_snapshot_query FOREIGN KEY (query_entry_id) REFERENCES catalog_search_entries(id),
  CHECK (query_field IN ('ALL','TITLE','AUTHOR','ISBN')),
  CHECK (language_filter IN ('ALL','ko','en')),
  CHECK (format_filter IN ('ALL','PRINT','EBOOK','AUDIOBOOK')),
  CHECK (JSON_TYPE(ranked_books) = 'ARRAY' AND JSON_LENGTH(ranked_books) <= 200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='필터와 순서를 고정한 15분 화면 결과';

CREATE TABLE catalog_crawl_jobs (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT '수집 job ID',
  source_id BIGINT NOT NULL COMMENT '호출 대상 source',
  query_entry_id BIGINT NOT NULL COMMENT '모든 job의 사용자 검색 세대 parent',
  source_record_id BIGINT NULL COMMENT 'FETCH_COVER 대상 원천',
  generation INT NOT NULL COMMENT '결과 쓰기 허용 세대',
  kind VARCHAR(24) NOT NULL COMMENT 'SEARCH FETCH_COVER',
  state VARCHAR(16) NOT NULL DEFAULT 'QUEUED' COMMENT 'QUEUED RUNNING RETRY SUCCEEDED FAILED CANCELLED',
  dedupe_key BINARY(32) NOT NULL COMMENT 'kind source 대상별 중복 방지 hash',
  active_key BINARY(32) GENERATED ALWAYS AS
    (CASE WHEN state IN ('QUEUED','RUNNING','RETRY') THEN dedupe_key ELSE NULL END) STORED COMMENT '실행 중인 작업만 unique',
  deadline_at DATETIME(6) NOT NULL COMMENT '원래 검색 세대 시작 후 10분 작업 기한',
  attempt_count INT NOT NULL DEFAULT 0 COMMENT 'job 실행 시도 횟수 최대 3회',
  available_at DATETIME(6) NOT NULL COMMENT '예약 실행 시각',
  lease_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'worker fencing token',
  lease_until DATETIME(6) NULL COMMENT 'lease 만료 시각',
  safe_error_code VARCHAR(40) NULL COMMENT '원문 없는 오류 분류',
  finished_at DATETIME(6) NULL COMMENT '최종 종료 시각',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
  PRIMARY KEY (id),
  UNIQUE KEY uk_catalog_job_active (active_key, is_test_data),
  KEY idx_catalog_job_due (state, available_at, id),
  KEY idx_catalog_job_lease (state, lease_until, id),
  KEY idx_catalog_job_query (query_entry_id, generation, source_id),
  KEY idx_catalog_job_retention (finished_at, id),
  CONSTRAINT fk_catalog_job_source FOREIGN KEY (source_id) REFERENCES catalog_sources(id),
  CONSTRAINT fk_catalog_job_query FOREIGN KEY (query_entry_id) REFERENCES catalog_search_entries(id),
  CONSTRAINT fk_catalog_job_record FOREIGN KEY (source_record_id) REFERENCES catalog_book_sources(id),
  CHECK (kind IN ('SEARCH','FETCH_COVER')),
  CHECK (state IN ('QUEUED','RUNNING','RETRY','SUCCEEDED','FAILED','CANCELLED')),
  CHECK (
    (kind = 'SEARCH' AND source_record_id IS NULL)
    OR (kind = 'FETCH_COVER' AND source_record_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='재시작 가능한 도서 수집 작업';

ALTER TABLE books
  ADD COLUMN catalog_book_id BIGINT NULL COMMENT '공용 판본 연결 NULL은 기존 또는 직접 등록',
  ADD COLUMN active_catalog_book_id BIGINT GENERATED ALWAYS AS
    (CASE WHEN deleted_at IS NULL THEN catalog_book_id ELSE NULL END) STORED COMMENT '활성 개인 서재의 catalog 중복 방지',
  ADD KEY idx_books_catalog (catalog_book_id),
  ADD UNIQUE KEY uk_books_user_active_catalog (user_id, active_catalog_book_id),
  ADD CONSTRAINT fk_books_catalog FOREIGN KEY (catalog_book_id) REFERENCES catalog_books(id);
INSERT INTO catalog_storage_budget (id, query_hmac_key) VALUES (1, RANDOM_BYTES(32));

-- 정책/연결 상태는 운영 config에서 명시적으로 활성화한다. 도서 선행 수집은 없다.
INSERT INTO catalog_sources (code,display_name,adapter_type,priority) VALUES
('open_library','Open Library','API',10),
('google_books','Google Books','API',20),
('aladin','알라딘','API',30),
('kakao_books','Kakao 책','API',40),
('nl_seoji','국립중앙도서관','API',5),
('naver_books','네이버 책','API',50),
('goodreads','Goodreads','HTML',60),
('kyobo','교보문고','HTML',70),
('yes24','YES24','HTML',80);
