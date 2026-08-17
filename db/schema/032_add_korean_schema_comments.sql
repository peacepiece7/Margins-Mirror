-- DBeaver와 information_schema에서 schema 용도를 바로 확인할 수 있도록
-- migration 031까지 존재하는 모든 application table과 column에 한국어 설명을 추가한다.
-- COMMENT만 추가하며 column type, default, nullability, generated expression,
-- index, foreign key와 저장 데이터는 변경하지 않는다.

-- account_email_challenges: 계정 변경 전 이메일 소유 확인과 일회성 실행 토큰을 관리하는 테이블
ALTER TABLE `account_email_challenges`
  COMMENT = '계정 변경 전 이메일 소유 확인과 일회성 실행 토큰을 관리하는 테이블',
  MODIFY COLUMN `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `purpose` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일 확인이 필요한 계정 작업 종류',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 이메일 주소',
  MODIFY COLUMN `code_hmac` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일로 발송한 확인 코드의 HMAC-SHA-256 값',
  MODIFY COLUMN `failed_attempts` int NOT NULL DEFAULT '0' COMMENT '실패한 시도 누적 횟수',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '이 레코드 또는 권한이 만료되는 시각',
  MODIFY COLUMN `verified_at` timestamp NULL DEFAULT NULL COMMENT '이메일 확인 코드 검증에 성공한 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값이 사용되어 다시 쓸 수 없게 된 시각',
  MODIFY COLUMN `action_token_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '확인 완료 후 계정 작업에 사용하는 일회성 토큰 해시',
  MODIFY COLUMN `action_token_expires_at` timestamp NULL DEFAULT NULL COMMENT '계정 작업용 일회성 토큰 만료 시각',
  MODIFY COLUMN `request_ip_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '요청 IP 원문을 저장하지 않은 HMAC-SHA-256 값',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- account_lifecycle_events: 회원 탈퇴와 개인정보 파기 처리 결과를 기록하는 계정 생명주기 이력 테이블
ALTER TABLE `account_lifecycle_events`
  COMMENT = '회원 탈퇴와 개인정보 파기 처리 결과를 기록하는 계정 생명주기 이력 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `transition_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '탈퇴·복구·파기 등 계정 상태 전이 종류',
  MODIFY COLUMN `result` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '계정 상태 전이 처리 결과',
  MODIFY COLUMN `processed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '계정 상태 전이를 처리한 시각',
  MODIFY COLUMN `purge_after` timestamp NULL DEFAULT NULL COMMENT '개인정보 파기를 실행할 수 있는 기준 시각'
;

-- anonymous_exit_survey_monthly_aggregates: 재식별 정보 없이 탈퇴 설문 응답을 월별로 집계한 테이블
ALTER TABLE `anonymous_exit_survey_monthly_aggregates`
  COMMENT = '재식별 정보 없이 탈퇴 설문 응답을 월별로 집계한 테이블',
  MODIFY COLUMN `aggregate_month` date NOT NULL COMMENT '집계 대상 월의 첫 날짜',
  MODIFY COLUMN `reason_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '탈퇴 사유 분류 코드',
  MODIFY COLUMN `gender_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '익명 집계용 성별 분류 코드이며 빈 문자열은 미응답',
  MODIFY COLUMN `age_band` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '익명 집계용 연령대이며 빈 문자열은 미응답',
  MODIFY COLUMN `country_code` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '익명 집계용 ISO 국가 코드이며 빈 문자열은 미응답',
  MODIFY COLUMN `response_count` bigint NOT NULL COMMENT '해당 분류 조합의 설문 응답 수',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- anonymous_exit_surveys: 회원 탈퇴 사유와 선택적 인구통계 응답을 익명으로 저장하는 테이블
ALTER TABLE `anonymous_exit_surveys`
  COMMENT = '회원 탈퇴 사유와 선택적 인구통계 응답을 익명으로 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `reason_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자가 선택한 탈퇴 사유 코드',
  MODIFY COLUMN `gender_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택한 성별 분류 코드',
  MODIFY COLUMN `gender_text` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '기타 성별을 선택한 경우 입력한 내용',
  MODIFY COLUMN `age_band` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택한 연령대',
  MODIFY COLUMN `country_code` char(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택한 ISO 국가 코드',
  MODIFY COLUMN `region` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택적으로 입력한 지역명',
  MODIFY COLUMN `other_text` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '기타 탈퇴 사유의 자유 입력 내용',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_month` date NOT NULL COMMENT '레코드 생성 월의 첫 날짜',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- auth_email_verification_rate_limits: 이메일 인증 코드 발송 남용을 막기 위한 범위별 요청 횟수 테이블
ALTER TABLE `auth_email_verification_rate_limits`
  COMMENT = '이메일 인증 코드 발송 남용을 막기 위한 범위별 요청 횟수 테이블',
  MODIFY COLUMN `scope_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '요청 제한 범위 종류로 EMAIL 또는 IP',
  MODIFY COLUMN `scope_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문 이메일 또는 IP를 저장하지 않은 HMAC-SHA-256 범위 식별값',
  MODIFY COLUMN `minute_window_started_at` timestamp NULL DEFAULT NULL COMMENT '1분 요청 횟수 집계가 시작된 시각',
  MODIFY COLUMN `minute_count` int NOT NULL DEFAULT '0' COMMENT '현재 1분 구간의 요청 횟수',
  MODIFY COLUMN `hour_window_started_at` timestamp NULL DEFAULT NULL COMMENT '1시간 요청 횟수 집계가 시작된 시각',
  MODIFY COLUMN `hour_count` int NOT NULL DEFAULT '0' COMMENT '현재 1시간 구간의 요청 횟수',
  MODIFY COLUMN `day_window_started_at` timestamp NULL DEFAULT NULL COMMENT '24시간 요청 횟수 집계가 시작된 시각',
  MODIFY COLUMN `day_count` int NOT NULL DEFAULT '0' COMMENT '현재 24시간 구간의 요청 횟수',
  MODIFY COLUMN `retention_after` timestamp NOT NULL COMMENT '남용 방지 상태를 삭제할 수 있는 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- auth_email_verifications: 회원가입 이메일 인증 코드의 해시와 사용 상태를 저장하는 테이블
ALTER TABLE `auth_email_verifications`
  COMMENT = '회원가입 이메일 인증 코드의 해시와 사용 상태를 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 이메일 주소',
  MODIFY COLUMN `code_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일로 발송한 인증 코드의 SHA-256 해시값',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '이 레코드 또는 권한이 만료되는 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값이 사용되어 다시 쓸 수 없게 된 시각',
  MODIFY COLUMN `confirmed_at` timestamp NULL DEFAULT NULL COMMENT '사용자가 해당 인증 코드 확인에 성공한 시각',
  MODIFY COLUMN `failed_attempts` int NOT NULL DEFAULT '0' COMMENT '실패한 시도 누적 횟수',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- book_candidates: AI 또는 외부 검색이 제안한 도서 후보와 선택 결과를 기록하는 테이블
ALTER TABLE `book_candidates`
  COMMENT = 'AI 또는 외부 검색이 제안한 도서 후보와 선택 결과를 기록하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `query_text` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '도서 후보 검색에 사용한 사용자 입력',
  MODIFY COLUMN `candidate_rank` int NOT NULL COMMENT '검색 결과 안에서 후보가 제시된 순서',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자에게 표시하는 제목',
  MODIFY COLUMN `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 저자명',
  MODIFY COLUMN `publisher` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '후보 도서 출판사',
  MODIFY COLUMN `published_year` int DEFAULT NULL COMMENT '후보 도서 출간 연도',
  MODIFY COLUMN `isbn` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '후보 도서의 ISBN',
  MODIFY COLUMN `confidence_score` decimal(6,5) DEFAULT NULL COMMENT 'AI가 산정한 후보 일치 신뢰도',
  MODIFY COLUMN `ai_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '후보 생성에 사용한 AI 모델명',
  MODIFY COLUMN `prompt_snapshot` json DEFAULT NULL COMMENT '후보 생성 요청의 프롬프트 스냅샷',
  MODIFY COLUMN `response_snapshot` json DEFAULT NULL COMMENT '후보 생성 응답의 원본 스냅샷',
  MODIFY COLUMN `selected_book_id` bigint DEFAULT NULL COMMENT '사용자가 최종 선택해 저장한 도서 식별자',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- book_knowledge: 사용자와 무관하게 재사용하는 도서 요약 및 토론 지식 테이블
ALTER TABLE `book_knowledge`
  COMMENT = '사용자와 무관하게 재사용하는 도서 요약 및 토론 지식 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `isbn` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 지식을 식별하는 ISBN',
  MODIFY COLUMN `title_normalized` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검색과 중복 방지를 위해 정규화한 도서명',
  MODIFY COLUMN `author_normalized` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검색과 중복 방지를 위해 정규화한 저자명',
  MODIFY COLUMN `lookup_key_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISBN 또는 제목·저자 등 조회 키 생성 방식',
  MODIFY COLUMN `lookup_key` varchar(600) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동일 도서 지식 재사용을 위한 정규화 조회 키',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자에게 표시하는 제목',
  MODIFY COLUMN `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 저자명',
  MODIFY COLUMN `summary` text COLLATE utf8mb4_unicode_ci COMMENT 'AI가 생성한 사용자 중립적 도서 요약',
  MODIFY COLUMN `themes_json` json NOT NULL COMMENT '도서의 주요 주제 목록 JSON',
  MODIFY COLUMN `discussion_points_json` json NOT NULL COMMENT '토론할 만한 논점 목록 JSON',
  MODIFY COLUMN `recommended_personas_json` json NOT NULL COMMENT '추천 토론 Persona 목록 JSON',
  MODIFY COLUMN `famous_quotes_json` json NOT NULL COMMENT '공개적으로 알려진 주요 인용 정보 JSON',
  MODIFY COLUMN `keywords_json` json NOT NULL COMMENT '도서 검색과 문맥 구성용 키워드 목록 JSON',
  MODIFY COLUMN `prompt_version` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '도서 지식 생성 프롬프트 버전',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ready' COMMENT '도서 지식 생성 상태',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 지식 생성 실패 사유',
  MODIFY COLUMN `generated_at` timestamp NULL DEFAULT NULL COMMENT '도서 지식 생성이 완료된 시각',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- books: 사용자가 서재에 저장한 도서와 독서 상태를 관리하는 테이블
ALTER TABLE `books`
  COMMENT = '사용자가 서재에 저장한 도서와 독서 상태를 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자에게 표시하는 제목',
  MODIFY COLUMN `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 부제',
  MODIFY COLUMN `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 저자명',
  MODIFY COLUMN `publisher` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 출판사',
  MODIFY COLUMN `published_year` int DEFAULT NULL COMMENT '도서 출간 연도',
  MODIFY COLUMN `isbn` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 ISBN',
  MODIFY COLUMN `language_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 언어 코드',
  MODIFY COLUMN `description` text COLLATE utf8mb4_unicode_ci COMMENT '도서 소개 또는 설명',
  MODIFY COLUMN `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ai' COMMENT '도서 정보가 등록된 출처',
  MODIFY COLUMN `source_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '외부 도서 제공자의 원본 식별자',
  MODIFY COLUMN `cover_image_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 표지 이미지 주소',
  MODIFY COLUMN `raw_metadata` json DEFAULT NULL COMMENT '외부 제공자 원본 정보와 AI 도서 프로필 JSON',
  MODIFY COLUMN `reading_status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'want_to_read' COMMENT '서재 독서 상태로 want_to_read·reading·read·dnf 중 하나',
  MODIFY COLUMN `rating` decimal(2,1) DEFAULT NULL COMMENT '사용자 평점으로 0.5부터 5.0까지의 반점 단위 값',
  MODIFY COLUMN `status_started_at` timestamp NULL DEFAULT NULL COMMENT '현재 독서 상태가 시작된 시각',
  MODIFY COLUMN `status_finished_at` timestamp NULL DEFAULT NULL COMMENT '완독 또는 중단 상태가 된 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- memory_card_groups: 사용자별 암기 카드 묶음을 관리하는 테이블
ALTER TABLE `memory_card_groups`
  COMMENT = '사용자별 암기 카드 묶음을 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자에게 표시하는 제목',
  MODIFY COLUMN `description` text COLLATE utf8mb4_unicode_ci COMMENT '암기 카드 묶음 설명',
  MODIFY COLUMN `source_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '카드 내용을 가져온 출처 표시명',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- memory_cards: 암기 카드의 앞면·뒷면 내용과 학습 상태를 저장하는 테이블
ALTER TABLE `memory_cards`
  COMMENT = '암기 카드의 앞면·뒷면 내용과 학습 상태를 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `group_id` bigint NOT NULL COMMENT '카드가 속한 암기 카드 묶음 식별자',
  MODIFY COLUMN `front_text` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '암기 카드 앞면에 표시할 질문 또는 단어',
  MODIFY COLUMN `back_text` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '암기 카드 뒷면에 표시할 정답 또는 뜻',
  MODIFY COLUMN `example_text` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '학습을 돕는 예문',
  MODIFY COLUMN `memo` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '사용자가 남긴 추가 메모',
  MODIFY COLUMN `memorized` tinyint(1) NOT NULL DEFAULT '0' COMMENT '사용자가 암기 완료로 표시했는지 여부',
  MODIFY COLUMN `position` int NOT NULL DEFAULT '0' COMMENT '묶음 안에서 카드를 표시하는 순서',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- messages: 독서 세션의 사용자·AI·Persona 대화 메시지를 보존하는 테이블
ALTER TABLE `messages`
  COMMENT = '독서 세션의 사용자·AI·Persona 대화 메시지를 보존하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint NOT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `parent_message_id` bigint DEFAULT NULL COMMENT '답글이 참조하는 상위 메시지 식별자',
  MODIFY COLUMN `role` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '메시지 작성 주체 역할로 user·assistant·persona·system 등',
  MODIFY COLUMN `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '메시지 본문',
  MODIFY COLUMN `content_format` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'markdown' COMMENT '메시지 본문 형식',
  MODIFY COLUMN `message_order` int NOT NULL COMMENT '작업 공간 안에서 메시지를 표시하는 순서',
  MODIFY COLUMN `ai_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '메시지 생성에 사용한 AI 모델명',
  MODIFY COLUMN `persona_id` bigint DEFAULT NULL COMMENT '관련 AI 토론 Persona 식별자',
  MODIFY COLUMN `question_id` bigint DEFAULT NULL COMMENT '관련 질문 식별자',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT 'AI 응답 생성에 사용한 제한된 문맥과 참조 ID JSON',
  MODIFY COLUMN `token_usage` json DEFAULT NULL COMMENT 'AI 제공자가 보고한 입력·출력 토큰 사용량 JSON',
  MODIFY COLUMN `streaming_status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'complete' COMMENT '스트리밍 메시지의 생성 진행 상태',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- metrics: 원본 독서 활동에서 계산하거나 수동 생성한 지표를 누적하는 테이블
ALTER TABLE `metrics`
  COMMENT = '원본 독서 활동에서 계산하거나 수동 생성한 지표를 누적하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `book_id` bigint DEFAULT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `session_id` bigint DEFAULT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint DEFAULT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `question_id` bigint DEFAULT NULL COMMENT '관련 질문 식별자',
  MODIFY COLUMN `persona_id` bigint DEFAULT NULL COMMENT '관련 AI 토론 Persona 식별자',
  MODIFY COLUMN `metric_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '지표를 식별하는 이름',
  MODIFY COLUMN `metric_scope` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자·도서·세션·작업 공간 등 지표 집계 범위',
  MODIFY COLUMN `metric_period_start` date DEFAULT NULL COMMENT '지표 집계 기간 시작일',
  MODIFY COLUMN `metric_period_end` date DEFAULT NULL COMMENT '지표 집계 기간 종료일',
  MODIFY COLUMN `metric_value` decimal(18,4) DEFAULT NULL COMMENT '계산된 지표 수치',
  MODIFY COLUMN `metric_unit` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '지표 수치의 단위',
  MODIFY COLUMN `metric_details` json DEFAULT NULL COMMENT '확장 가능한 지표 차원과 근거 값 JSON',
  MODIFY COLUMN `source_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '지표 생성 원본 또는 작업의 참조값',
  MODIFY COLUMN `generated_by` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system' COMMENT '지표를 생성한 시스템 또는 작업 이름',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- moderation_daily_aggregates: 재식별 정보 없이 토론 입력 검토 결과를 일별로 집계한 테이블
ALTER TABLE `moderation_daily_aggregates`
  COMMENT = '재식별 정보 없이 토론 입력 검토 결과를 일별로 집계한 테이블',
  MODIFY COLUMN `aggregate_date` date NOT NULL COMMENT '검토 이벤트 집계 기준일',
  MODIFY COLUMN `decision` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검토 결정으로 ALLOW·REDIRECT·REJECT 중 하나',
  MODIFY COLUMN `intent` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력에서 분류한 사용자 의도',
  MODIFY COLUMN `reason_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사유를 분류하는 표준 코드',
  MODIFY COLUMN `model` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토에 사용한 AI 모델명',
  MODIFY COLUMN `prompt_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 프롬프트 버전',
  MODIFY COLUMN `fallback_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'AI 실패 시 규칙 기반 대체 판단을 사용했는지 여부',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `event_count` bigint NOT NULL DEFAULT '0' COMMENT '해당 분류의 전체 검토 이벤트 수',
  MODIFY COLUMN `persona_called_count` bigint NOT NULL DEFAULT '0' COMMENT '검토 후 Persona 응답을 호출한 수',
  MODIFY COLUMN `related_feedback_count` bigint NOT NULL DEFAULT '0' COMMENT '사용자가 관련 있음으로 평가한 수',
  MODIFY COLUMN `not_related_feedback_count` bigint NOT NULL DEFAULT '0' COMMENT '사용자가 관련 없음으로 평가한 수',
  MODIFY COLUMN `latency_sum_ms` bigint NOT NULL DEFAULT '0' COMMENT '평균 계산을 위한 검토 지연시간 합계(밀리초)',
  MODIFY COLUMN `latency_max_ms` int NOT NULL DEFAULT '0' COMMENT '가장 긴 검토 지연시간(밀리초)',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- moderation_events: 토론 입력의 허용·전환·거절 판단과 라우팅 근거를 기록하는 테이블
ALTER TABLE `moderation_events`
  COMMENT = '토론 입력의 허용·전환·거절 판단과 라우팅 근거를 기록하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `request_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '한 번의 입력 검토 요청을 식별하는 UUID',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `book_id` bigint NOT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint NOT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `message_id` bigint DEFAULT NULL COMMENT '허용된 입력으로 저장된 사용자 메시지 식별자',
  MODIFY COLUMN `input_text` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '전환 또는 거절된 경우에만 보관하는 사용자 입력 원문',
  MODIFY COLUMN `decision` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검토 결정으로 ALLOW·REDIRECT·REJECT 중 하나',
  MODIFY COLUMN `intent` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력에서 분류한 사용자 의도',
  MODIFY COLUMN `relevance_score` decimal(6,5) NOT NULL COMMENT '현재 독서 토론과의 관련성 점수',
  MODIFY COLUMN `confidence` decimal(6,5) NOT NULL COMMENT '검토 결정의 신뢰도 점수',
  MODIFY COLUMN `reason_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사유를 분류하는 표준 코드',
  MODIFY COLUMN `suggested_question` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '전환 결정 시 사용자에게 제안하는 독서 관련 질문',
  MODIFY COLUMN `model` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토에 사용한 AI 모델명',
  MODIFY COLUMN `policy_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '적용한 검토 정책 버전',
  MODIFY COLUMN `prompt_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 프롬프트 버전',
  MODIFY COLUMN `schema_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '구조화된 검토 응답 스키마 버전',
  MODIFY COLUMN `latency_ms` int NOT NULL COMMENT '입력 검토에 걸린 시간(밀리초)',
  MODIFY COLUMN `fallback_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'AI 실패 시 규칙 기반 대체 판단을 사용했는지 여부',
  MODIFY COLUMN `routing_outcome` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검토 후 실제로 수행한 라우팅 결과',
  MODIFY COLUMN `persona_called` tinyint(1) NOT NULL DEFAULT '0' COMMENT '검토 후 Persona 응답을 호출했는지 여부',
  MODIFY COLUMN `provider_error_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 제공자 호출 실패 시 정규화한 오류 코드',
  MODIFY COLUMN `user_feedback` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '검토 결과에 대한 사용자의 관련성 평가',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '레코드가 마지막으로 변경된 시각'
;

-- pending_google_registrations: Google 로그인 후 약관 동의를 기다리는 임시 가입 정보를 저장하는 테이블
ALTER TABLE `pending_google_registrations`
  COMMENT = 'Google 로그인 후 약관 동의를 기다리는 임시 가입 정보를 저장하는 테이블',
  MODIFY COLUMN `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문을 저장하지 않은 토큰 해시값',
  MODIFY COLUMN `provider_subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Google이 발급한 사용자 고유 식별자',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Google이 전달한 이메일 주소',
  MODIFY COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Google이 이메일 확인 완료로 전달했는지 여부',
  MODIFY COLUMN `display_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Google이 전달한 사용자 표시명',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '이 레코드 또는 권한이 만료되는 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값이 사용되어 다시 쓸 수 없게 된 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- pending_registration_intents: 일반 회원가입 전 개인정보·AI 이전 동의 의사를 임시 저장하는 테이블
ALTER TABLE `pending_registration_intents`
  COMMENT = '일반 회원가입 전 개인정보·AI 이전 동의 의사를 임시 저장하는 테이블',
  MODIFY COLUMN `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문을 저장하지 않은 토큰 해시값',
  MODIFY COLUMN `privacy_policy_version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의한 개인정보 처리방침 문서 버전',
  MODIFY COLUMN `ai_transfer_version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의한 국외 AI 처리 안내 문서 버전',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '이 레코드 또는 권한이 만료되는 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값이 사용되어 다시 쓸 수 없게 된 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- personas: AI 토론 참여자의 이름과 행동 지침을 정의하는 테이블
ALTER TABLE `personas`
  COMMENT = 'AI 토론 참여자의 이름과 행동 지침을 정의하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '코드와 API에서 사용하는 Persona 고유 이름',
  MODIFY COLUMN `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 화면에 표시하는 Persona 이름',
  MODIFY COLUMN `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Persona의 관점과 역할 설명',
  MODIFY COLUMN `system_prompt` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI가 Persona 역할로 답하도록 하는 시스템 지침',
  MODIFY COLUMN `tone` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Persona의 대표 말투 또는 어조',
  MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '새 토론에서 선택 가능한 활성 Persona인지 여부',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- questions: 독서 세션에서 AI가 생성하거나 제시한 질문을 저장하는 테이블
ALTER TABLE `questions`
  COMMENT = '독서 세션에서 AI가 생성하거나 제시한 질문을 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint DEFAULT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `question_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자에게 제시하는 질문 본문',
  MODIFY COLUMN `question_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reflection' COMMENT '성찰·토론 등 질문 종류',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '질문의 활성 또는 처리 상태',
  MODIFY COLUMN `ai_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '질문 생성에 사용한 AI 모델명',
  MODIFY COLUMN `prompt_snapshot` json DEFAULT NULL COMMENT '질문 생성 요청의 프롬프트 스냅샷',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT '질문 생성에 사용한 독서 문맥 JSON',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- reading_sessions: 사용자와 도서를 연결한 독서 및 성찰 활동 단위를 관리하는 테이블
ALTER TABLE `reading_sessions`
  COMMENT = '사용자와 도서를 연결한 독서 및 성찰 활동 단위를 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `book_id` bigint NOT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '독서 세션 제목',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '독서 세션의 진행 상태',
  MODIFY COLUMN `is_pinned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '서재 목록 상단 고정 여부',
  MODIFY COLUMN `reading_goal` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '이 독서 세션에서 달성하려는 목표',
  MODIFY COLUMN `start_page` int DEFAULT NULL COMMENT '세션 시작 시점의 페이지',
  MODIFY COLUMN `current_page` int DEFAULT NULL COMMENT '현재까지 읽은 페이지',
  MODIFY COLUMN `target_page` int DEFAULT NULL COMMENT '목표로 설정한 마지막 페이지',
  MODIFY COLUMN `progress_note` text COLLATE utf8mb4_unicode_ci COMMENT '독서 진행 상황에 대한 사용자 메모',
  MODIFY COLUMN `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '독서 세션을 시작한 시각',
  MODIFY COLUMN `completed_at` timestamp NULL DEFAULT NULL COMMENT '독서 세션을 완료한 시각',
  MODIFY COLUMN `summary` text COLLATE utf8mb4_unicode_ci COMMENT '독서 세션 전체 요약',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT '세션 문맥을 재구성하기 위한 확장 JSON',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- refresh_tokens: 로그인 세션 갱신 토큰의 해시와 폐기 상태를 관리하는 테이블
ALTER TABLE `refresh_tokens`
  COMMENT = '로그인 세션 갱신 토큰의 해시와 폐기 상태를 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문을 저장하지 않은 refresh token SHA-256 해시',
  MODIFY COLUMN `jti` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'refresh token의 JWT 고유 식별자',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '이 레코드 또는 권한이 만료되는 시각',
  MODIFY COLUMN `revoked_at` timestamp NULL DEFAULT NULL COMMENT 'refresh token을 폐기한 시각',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각'
;

-- review_comments: 공개 독서 리뷰의 댓글과 한 단계 답글을 저장하는 테이블
ALTER TABLE `review_comments`
  COMMENT = '공개 독서 리뷰의 댓글과 한 단계 답글을 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `insight_id` bigint NOT NULL COMMENT '댓글이 달린 공개 리뷰 통찰 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `parent_comment_id` bigint DEFAULT NULL COMMENT '답글이 참조하는 상위 댓글 식별자',
  MODIFY COLUMN `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '댓글 또는 답글 본문',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- schema_migrations: 적용된 DB 마이그레이션 파일과 체크섬을 기록하는 이력 테이블
ALTER TABLE `schema_migrations`
  COMMENT = '적용된 DB 마이그레이션 파일과 체크섬을 기록하는 이력 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '파일명에서 추출한 마이그레이션 버전',
  MODIFY COLUMN `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '적용된 마이그레이션 파일명',
  MODIFY COLUMN `checksum_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '적용 당시 마이그레이션 파일의 SHA-256 체크섬',
  MODIFY COLUMN `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '마이그레이션 적용이 완료된 시각'
;

-- session_highlights: 독서 세션에서 저장한 인용문과 근거 메모를 관리하는 테이블
ALTER TABLE `session_highlights`
  COMMENT = '독서 세션에서 저장한 인용문과 근거 메모를 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `book_id` bigint NOT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `page_number` int DEFAULT NULL COMMENT '인용문이 위치한 도서 페이지',
  MODIFY COLUMN `location_label` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '전자책 위치 등 페이지 외 위치 표시',
  MODIFY COLUMN `quote_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자가 저장한 도서 인용문',
  MODIFY COLUMN `note` text COLLATE utf8mb4_unicode_ci COMMENT '인용문에 대해 사용자가 남긴 메모',
  MODIFY COLUMN `highlight_order` int NOT NULL COMMENT '세션 안에서 인용문을 표시하는 순서',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- session_insights: 독서 세션에서 정리한 답변·감상·핵심 통찰과 공개 리뷰를 저장하는 테이블
ALTER TABLE `session_insights`
  COMMENT = '독서 세션에서 정리한 답변·감상·핵심 통찰과 공개 리뷰를 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `question_id` bigint DEFAULT NULL COMMENT '이 답변 또는 통찰의 출발점이 된 질문 식별자',
  MODIFY COLUMN `insight_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'takeaway' COMMENT '핵심 정리·질문 답변 등 통찰 종류',
  MODIFY COLUMN `title` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '통찰 또는 공개 리뷰 제목',
  MODIFY COLUMN `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자가 작성한 통찰·답변·리뷰 본문',
  MODIFY COLUMN `summary` text COLLATE utf8mb4_unicode_ci COMMENT 'AI가 생성한 통찰 본문 요약',
  MODIFY COLUMN `summary_source_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '요약 대상 본문의 변경 여부를 확인하는 SHA-256 해시',
  MODIFY COLUMN `summary_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '요약 생성에 사용한 AI 모델명',
  MODIFY COLUMN `summary_token_usage` json DEFAULT NULL COMMENT '요약 생성 시 제공자가 보고한 토큰 사용량 JSON',
  MODIFY COLUMN `summarized_at` timestamp NULL DEFAULT NULL COMMENT '현재 요약이 생성된 시각',
  MODIFY COLUMN `summary_status` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '요약 생성의 현재 상태',
  MODIFY COLUMN `evidence` text COLLATE utf8mb4_unicode_ci COMMENT '통찰을 뒷받침하는 인용 또는 근거',
  MODIFY COLUMN `author_name` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '공개 리뷰에 표시할 작성자명',
  MODIFY COLUMN `visibility` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PRIVATE' COMMENT '공개 범위로 PRIVATE 또는 PUBLIC',
  MODIFY COLUMN `reviewed_on` date DEFAULT NULL COMMENT '사용자가 지정한 리뷰 작성일',
  MODIFY COLUMN `insight_order` int NOT NULL COMMENT '세션 안에서 통찰을 표시하는 순서',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태',
  MODIFY COLUMN `active_question_id` bigint GENERATED ALWAYS AS ((case when (`deleted_at` is null) then `question_id` else NULL end)) STORED COMMENT '삭제되지 않은 질문 답변의 유일성을 보장하는 생성 컬럼'
;

-- session_tags: 독서 세션을 분류하기 위해 사용자가 붙인 태그를 저장하는 테이블
ALTER TABLE `session_tags`
  COMMENT = '독서 세션을 분류하기 위해 사용자가 붙인 태그를 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자가 입력한 세션 분류 태그명',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- session_windows: 독서 세션 안의 질문·성찰·토론 작업 공간을 관리하는 테이블
ALTER TABLE `session_windows`
  COMMENT = '독서 세션 안의 질문·성찰·토론 작업 공간을 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `source_question_id` bigint DEFAULT NULL COMMENT '연관 토론 작업 공간의 출발 질문 식별자',
  MODIFY COLUMN `window_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '질문·성찰·토론 등 작업 공간 종류',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '작업 공간 제목',
  MODIFY COLUMN `position` int NOT NULL DEFAULT '0' COMMENT '세션 안에서 작업 공간을 표시하는 순서',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open' COMMENT '작업 공간의 열림·완료 등 진행 상태',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT '대화 요약 등 재생성 가능한 작업 공간 문맥 JSON',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태',
  MODIFY COLUMN `active_source_question_id` bigint GENERATED ALWAYS AS ((case when ((`deleted_at` is null) and (`window_type` = _utf8mb4'debate')) then `source_question_id` else NULL end)) STORED COMMENT '삭제되지 않은 연관 토론의 유일성을 보장하는 생성 컬럼'
;

-- shell_crawler_saves: ShellCrawler 게임의 사용자별 클라우드 이어하기 상태를 저장하는 테이블
ALTER TABLE `shell_crawler_saves`
  COMMENT = 'ShellCrawler 게임의 사용자별 클라우드 이어하기 상태를 저장하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `slot_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 안에서 저장 슬롯을 구분하는 키',
  MODIFY COLUMN `schema_version` int NOT NULL COMMENT '저장 데이터 구조 버전',
  MODIFY COLUMN `app_version` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '저장 데이터를 만든 애플리케이션 버전',
  MODIFY COLUMN `client_save_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '클라이언트가 생성한 저장 요청 고유 식별자',
  MODIFY COLUMN `client_saved_at` timestamp NOT NULL COMMENT '클라이언트에서 게임 상태를 저장한 시각',
  MODIFY COLUMN `summary_json` json NOT NULL COMMENT '이어하기 화면에 필요한 요약 상태 JSON',
  MODIFY COLUMN `state_json` json NOT NULL COMMENT '게임을 복원하는 전체 상태 JSON',
  MODIFY COLUMN `payload_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '저장 payload 무결성 확인용 SHA-256 체크섬',
  MODIFY COLUMN `revision` int NOT NULL DEFAULT '1' COMMENT '낙관적 동시성 제어용 저장 개정 번호',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;

-- user_consent_events: 사용자의 약관 동의 또는 철회 사실을 변경 불가 이벤트로 기록하는 테이블
ALTER TABLE `user_consent_events`
  COMMENT = '사용자의 약관 동의 또는 철회 사실을 변경 불가 이벤트로 기록하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `consent_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '개인정보 처리 또는 AI 이전 등 동의 종류',
  MODIFY COLUMN `document_version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의 또는 철회 대상 문서 버전',
  MODIFY COLUMN `event_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의·철회 등 발생한 이벤트 종류',
  MODIFY COLUMN `registration_channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'LOCAL·GOOGLE 등 동의가 발생한 가입 경로',
  MODIFY COLUMN `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '동의 또는 철회 이벤트가 발생한 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부'
;

-- user_memberships: 사용자별 무료·프리미엄 이용 등급과 유효기간을 관리하는 테이블
ALTER TABLE `user_memberships`
  COMMENT = '사용자별 무료·프리미엄 이용 등급과 유효기간을 관리하는 테이블',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이용 등급을 부여받은 사용자 식별자',
  MODIFY COLUMN `tier` enum('FREE','PREMIUM') NOT NULL DEFAULT 'FREE' COMMENT '현재 이용 등급으로 FREE 또는 PREMIUM',
  MODIFY COLUMN `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '현재 이용 등급을 부여한 시각',
  MODIFY COLUMN `expires_at` datetime DEFAULT NULL COMMENT '이용 등급 만료 시각이며 NULL이면 무기한',
  MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- user_oauth_identities: 사용자 계정과 Google 등 외부 로그인 식별자를 연결하는 테이블
ALTER TABLE `user_oauth_identities`
  COMMENT = '사용자 계정과 Google 등 외부 로그인 식별자를 연결하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이 레코드를 소유하거나 관련된 사용자 식별자',
  MODIFY COLUMN `provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'google 등 외부 로그인 제공자 코드',
  MODIFY COLUMN `provider_subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '외부 로그인 제공자가 발급한 사용자 고유 식별자',
  MODIFY COLUMN `provider_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '외부 로그인 제공자가 전달한 이메일 주소',
  MODIFY COLUMN `linked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '외부 로그인 식별자를 사용자 계정에 연결한 시각',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각'
;

-- users: 로그인 사용자 계정과 인증·탈퇴·개인정보 파기 상태를 관리하는 테이블
ALTER TABLE `users`
  COMMENT = '로그인 사용자 계정과 인증·탈퇴·개인정보 파기 상태를 관리하는 테이블',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '이 레코드의 고유 식별자',
  MODIFY COLUMN `username` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '로그인에 사용하는 변경 불가 사용자명',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '로그인과 알림에 사용하는 이메일 주소',
  MODIFY COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT '0' COMMENT '사용자 이메일 확인 완료 여부',
  MODIFY COLUMN `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '서비스 화면에 표시하는 사용자 이름',
  MODIFY COLUMN `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '로컬 로그인 비밀번호의 BCrypt 해시',
  MODIFY COLUMN `auth_provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local' COMMENT '계정을 생성한 인증 방식으로 local 또는 google',
  MODIFY COLUMN `account_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '계정 생명주기 상태로 ACTIVE·RESIGNED·PURGED 중 하나',
  MODIFY COLUMN `resigned_at` timestamp NULL DEFAULT NULL COMMENT '사용자가 회원 탈퇴를 확정한 시각',
  MODIFY COLUMN `personal_data_purge_scheduled_at` timestamp NULL DEFAULT NULL COMMENT '개인정보 파기 예정 시각',
  MODIFY COLUMN `personal_data_purged_at` timestamp NULL DEFAULT NULL COMMENT '개인정보 파기를 완료한 시각',
  MODIFY COLUMN `credentials_version` bigint NOT NULL DEFAULT '1' COMMENT '기존 인증 수단을 일괄 무효화하는 버전 값',
  MODIFY COLUMN `erase_activity_on_purge` tinyint(1) NOT NULL DEFAULT '0' COMMENT '개인정보 파기 시 독서 활동도 함께 삭제할지 여부',
  MODIFY COLUMN `failed_login_count` int NOT NULL DEFAULT '0' COMMENT '연속 로그인 실패 횟수',
  MODIFY COLUMN `locked_until` timestamp NULL DEFAULT NULL COMMENT '로그인 잠금이 해제되는 시각',
  MODIFY COLUMN `last_login_at` timestamp NULL DEFAULT NULL COMMENT '마지막 로그인 성공 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드가 생성된 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드가 마지막으로 변경된 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제된 시각이며 NULL이면 활성 상태'
;
