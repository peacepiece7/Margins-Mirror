-- 검색 결과와 화면 순서를 행으로 보관하고 표지 갱신 버전을 분리한다.
ALTER TABLE catalog_search_entries
  ADD COLUMN cover_version INT NOT NULL DEFAULT 0 COMMENT '표지 완료 공개 버전';
ALTER TABLE catalog_crawl_jobs
  ADD COLUMN page_number INT NOT NULL DEFAULT 1 COMMENT '제공처 검색 페이지 1부터 5';

CREATE TABLE catalog_search_source_runs (
  query_entry_id BIGINT NOT NULL COMMENT '공용 검색 ID',
  generation INT NOT NULL COMMENT '수집 세대',
  source_id BIGINT NOT NULL COMMENT '수집처 ID',
  completed_page INT NOT NULL DEFAULT 0 COMMENT '마지막 성공 페이지',
  has_more BOOLEAN NOT NULL DEFAULT FALSE COMMENT '미수집 페이지 존재',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  PRIMARY KEY (query_entry_id,generation,source_id),
  CONSTRAINT fk_catalog_run_query FOREIGN KEY (query_entry_id) REFERENCES catalog_search_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_run_source FOREIGN KEY (source_id) REFERENCES catalog_sources(id),
  CHECK (completed_page BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='검색 수집처별 페이지 진행';

CREATE TABLE catalog_search_hits (
  query_entry_id BIGINT NOT NULL COMMENT '공용 검색 ID',
  generation INT NOT NULL COMMENT '수집 세대',
  source_id BIGINT NOT NULL COMMENT '수집처 ID',
  catalog_book_id BIGINT NOT NULL COMMENT '도서 판본 ID',
  source_rank INT NOT NULL COMMENT '수집처 페이지를 포함한 순번',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  PRIMARY KEY (query_entry_id,generation,source_id,catalog_book_id),
  KEY idx_catalog_hits_rank (query_entry_id,generation,source_rank,catalog_book_id),
  CONSTRAINT fk_catalog_hit_query FOREIGN KEY (query_entry_id) REFERENCES catalog_search_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_hit_source FOREIGN KEY (source_id) REFERENCES catalog_sources(id),
  CONSTRAINT fk_catalog_hit_book FOREIGN KEY (catalog_book_id) REFERENCES catalog_books(id),
  CHECK (source_rank >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='검색별 제공처 도서 일치 근거';

CREATE TABLE catalog_search_snapshot_items (
  snapshot_id BIGINT NOT NULL COMMENT '고정 검색 화면 ID',
  ordinal INT NOT NULL COMMENT '화면 정렬 순번 0부터',
  catalog_book_id BIGINT NOT NULL COMMENT '도서 판본 ID',
  match_type VARCHAR(24) NOT NULL COMMENT '정렬 일치 근거',
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT '테스트 데이터 여부',
  PRIMARY KEY (snapshot_id,ordinal),
  UNIQUE KEY uk_catalog_snapshot_book (snapshot_id,catalog_book_id),
  CONSTRAINT fk_catalog_item_snapshot FOREIGN KEY (snapshot_id) REFERENCES catalog_search_snapshots(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_item_book FOREIGN KEY (catalog_book_id) REFERENCES catalog_books(id),
  CHECK (ordinal >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='검색 snapshot 페이지 항목';

-- 이전 snapshot은 기존 JSON 읽기 경로를 유지한다. 새 v3 snapshot만 행 저장을 사용한다.
