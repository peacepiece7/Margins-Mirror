-- Migration 033: 모든 현행 application table·column 설명을
-- 조사와 불필요한 서술어 없는 문서 제목형 명사구로 압축한다.
-- Migration 032의 full column definition을 유지하며 COMMENT만 변경한다.
-- column type, default, nullability, generated expression, index,
-- foreign key, 저장 데이터는 변경하지 않는다.

-- account_email_challenges: 계정 변경 이메일 소유 확인·일회성 실행 토큰 관리
ALTER TABLE `account_email_challenges`
  COMMENT = '계정 변경 이메일 소유 확인·일회성 실행 토큰 관리',
  MODIFY COLUMN `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `purpose` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일 확인 대상 계정 작업 종류',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 이메일 주소',
  MODIFY COLUMN `code_hmac` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일 발송 확인 코드 HMAC-SHA-256 값',
  MODIFY COLUMN `failed_attempts` int NOT NULL DEFAULT '0' COMMENT '실패 시도 누적 횟수',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '레코드·권한 만료 시각',
  MODIFY COLUMN `verified_at` timestamp NULL DEFAULT NULL COMMENT '이메일 확인 코드 검증 성공 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값 사용·재사용 불가 시각',
  MODIFY COLUMN `action_token_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '확인 완료 계정 작업용 일회성 토큰 해시',
  MODIFY COLUMN `action_token_expires_at` timestamp NULL DEFAULT NULL COMMENT '계정 작업용 일회성 토큰 만료 시각',
  MODIFY COLUMN `request_ip_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '요청 IP 비저장 HMAC-SHA-256 값',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- account_lifecycle_events: 회원 탈퇴·개인정보 파기 처리 결과 이력
ALTER TABLE `account_lifecycle_events`
  COMMENT = '회원 탈퇴·개인정보 파기 처리 결과 이력',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `transition_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '탈퇴·복구·파기 등 계정 상태 전이 종류',
  MODIFY COLUMN `result` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '계정 상태 전이 처리 결과',
  MODIFY COLUMN `processed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '계정 상태 전이 처리 시각',
  MODIFY COLUMN `purge_after` timestamp NULL DEFAULT NULL COMMENT '개인정보 파기 실행 가능 기준 시각'
;

-- anonymous_exit_survey_monthly_aggregates: 비식별 탈퇴 설문 월별 집계
ALTER TABLE `anonymous_exit_survey_monthly_aggregates`
  COMMENT = '비식별 탈퇴 설문 월별 집계',
  MODIFY COLUMN `aggregate_month` date NOT NULL COMMENT '집계 대상 월 시작일',
  MODIFY COLUMN `reason_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '탈퇴 사유 분류 코드',
  MODIFY COLUMN `gender_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '익명 집계 성별 분류 코드·빈 문자열 미응답',
  MODIFY COLUMN `age_band` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '익명 집계 연령대·빈 문자열 미응답',
  MODIFY COLUMN `country_code` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '익명 집계 ISO 국가 코드·빈 문자열 미응답',
  MODIFY COLUMN `response_count` bigint NOT NULL COMMENT '해당 분류 조합 설문 응답 수',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- anonymous_exit_surveys: 익명 회원 탈퇴 사유·선택 인구통계 응답
ALTER TABLE `anonymous_exit_surveys`
  COMMENT = '익명 회원 탈퇴 사유·선택 인구통계 응답',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `reason_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 선택 탈퇴 사유 코드',
  MODIFY COLUMN `gender_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택 성별 분류 코드',
  MODIFY COLUMN `gender_text` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '기타 성별 선택 입력 내용',
  MODIFY COLUMN `age_band` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택 연령대',
  MODIFY COLUMN `country_code` char(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택 ISO 국가 코드',
  MODIFY COLUMN `region` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '선택 입력 지역명',
  MODIFY COLUMN `other_text` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '기타 탈퇴 사유 자유 입력',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_month` date NOT NULL COMMENT '레코드 생성 월 시작일',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- auth_email_verification_rate_limits: 이메일 인증 코드 발송 남용 방지 범위별 요청 횟수
ALTER TABLE `auth_email_verification_rate_limits`
  COMMENT = '이메일 인증 코드 발송 남용 방지 범위별 요청 횟수',
  MODIFY COLUMN `scope_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '요청 제한 범위: EMAIL·IP',
  MODIFY COLUMN `scope_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일·IP 원문 비저장 HMAC-SHA-256 범위 식별값',
  MODIFY COLUMN `minute_window_started_at` timestamp NULL DEFAULT NULL COMMENT '1분 요청 횟수 집계 시작 시각',
  MODIFY COLUMN `minute_count` int NOT NULL DEFAULT '0' COMMENT '현재 1분 구간 요청 횟수',
  MODIFY COLUMN `hour_window_started_at` timestamp NULL DEFAULT NULL COMMENT '1시간 요청 횟수 집계 시작 시각',
  MODIFY COLUMN `hour_count` int NOT NULL DEFAULT '0' COMMENT '현재 1시간 구간 요청 횟수',
  MODIFY COLUMN `day_window_started_at` timestamp NULL DEFAULT NULL COMMENT '24시간 요청 횟수 집계 시작 시각',
  MODIFY COLUMN `day_count` int NOT NULL DEFAULT '0' COMMENT '현재 24시간 구간 요청 횟수',
  MODIFY COLUMN `retention_after` timestamp NOT NULL COMMENT '남용 방지 상태 삭제 가능 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- auth_email_verifications: 회원가입 이메일 인증 코드 해시·사용 상태
ALTER TABLE `auth_email_verifications`
  COMMENT = '회원가입 이메일 인증 코드 해시·사용 상태',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 이메일 주소',
  MODIFY COLUMN `code_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '이메일 발송 인증 코드 SHA-256 해시값',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '레코드·권한 만료 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값 사용·재사용 불가 시각',
  MODIFY COLUMN `confirmed_at` timestamp NULL DEFAULT NULL COMMENT '사용자 인증 코드 확인 성공 시각',
  MODIFY COLUMN `failed_attempts` int NOT NULL DEFAULT '0' COMMENT '실패 시도 누적 횟수',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- book_candidates: AI·외부 검색 도서 후보·선택 결과
ALTER TABLE `book_candidates`
  COMMENT = 'AI·외부 검색 도서 후보·선택 결과',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `query_text` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '도서 후보 검색 사용자 입력',
  MODIFY COLUMN `candidate_rank` int NOT NULL COMMENT '검색 결과 후보 제시 순서',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 표시 제목',
  MODIFY COLUMN `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 저자명',
  MODIFY COLUMN `publisher` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '후보 도서 출판사',
  MODIFY COLUMN `published_year` int DEFAULT NULL COMMENT '후보 도서 출간 연도',
  MODIFY COLUMN `isbn` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '후보 도서 ISBN',
  MODIFY COLUMN `confidence_score` decimal(6,5) DEFAULT NULL COMMENT 'AI 산정 후보 일치 신뢰도',
  MODIFY COLUMN `ai_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '후보 생성 AI 모델명',
  MODIFY COLUMN `prompt_snapshot` json DEFAULT NULL COMMENT '후보 생성 요청 프롬프트 스냅샷',
  MODIFY COLUMN `response_snapshot` json DEFAULT NULL COMMENT '후보 생성 응답 원본 스냅샷',
  MODIFY COLUMN `selected_book_id` bigint DEFAULT NULL COMMENT '사용자 최종 선택·저장 도서 식별자',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- book_knowledge: 사용자 독립 재사용 도서 요약·토론 지식
ALTER TABLE `book_knowledge`
  COMMENT = '사용자 독립 재사용 도서 요약·토론 지식',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `isbn` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 지식 식별 ISBN',
  MODIFY COLUMN `title_normalized` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검색·중복 방지 정규화 도서명',
  MODIFY COLUMN `author_normalized` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검색·중복 방지 정규화 저자명',
  MODIFY COLUMN `lookup_key_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISBN·제목·저자 기반 조회 키 생성 방식',
  MODIFY COLUMN `lookup_key` varchar(600) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동일 도서 지식 재사용 정규화 조회 키',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 표시 제목',
  MODIFY COLUMN `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 저자명',
  MODIFY COLUMN `summary` text COLLATE utf8mb4_unicode_ci COMMENT 'AI 생성 사용자 중립 도서 요약',
  MODIFY COLUMN `themes_json` json NOT NULL COMMENT '도서 주요 주제 목록 JSON',
  MODIFY COLUMN `discussion_points_json` json NOT NULL COMMENT '토론 논점 목록 JSON',
  MODIFY COLUMN `recommended_personas_json` json NOT NULL COMMENT '추천 토론 Persona 목록 JSON',
  MODIFY COLUMN `famous_quotes_json` json NOT NULL COMMENT '공개 주요 인용 정보 JSON',
  MODIFY COLUMN `keywords_json` json NOT NULL COMMENT '도서 검색·문맥 구성 키워드 목록 JSON',
  MODIFY COLUMN `prompt_version` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '도서 지식 생성 프롬프트 버전',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ready' COMMENT '도서 지식 생성 상태',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 지식 생성 실패 사유',
  MODIFY COLUMN `generated_at` timestamp NULL DEFAULT NULL COMMENT '도서 지식 생성 완료 시각',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- books: 사용자 서재 도서·독서 상태
ALTER TABLE `books`
  COMMENT = '사용자 서재 도서·독서 상태',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 표시 제목',
  MODIFY COLUMN `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 부제',
  MODIFY COLUMN `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 저자명',
  MODIFY COLUMN `publisher` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 출판사',
  MODIFY COLUMN `published_year` int DEFAULT NULL COMMENT '도서 출간 연도',
  MODIFY COLUMN `isbn` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 ISBN',
  MODIFY COLUMN `language_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 언어 코드',
  MODIFY COLUMN `description` text COLLATE utf8mb4_unicode_ci COMMENT '도서 소개·설명',
  MODIFY COLUMN `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ai' COMMENT '도서 정보 등록 출처',
  MODIFY COLUMN `source_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '외부 도서 제공자 원본 식별자',
  MODIFY COLUMN `cover_image_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '도서 표지 이미지 주소',
  MODIFY COLUMN `raw_metadata` json DEFAULT NULL COMMENT '외부 제공자 원본 정보·AI 도서 프로필 JSON',
  MODIFY COLUMN `reading_status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'want_to_read' COMMENT '서재 독서 상태: want_to_read·reading·read·dnf',
  MODIFY COLUMN `rating` decimal(2,1) DEFAULT NULL COMMENT '사용자 평점: 0.5~5.0, 0.5 단위',
  MODIFY COLUMN `status_started_at` timestamp NULL DEFAULT NULL COMMENT '현재 독서 상태 시작 시각',
  MODIFY COLUMN `status_finished_at` timestamp NULL DEFAULT NULL COMMENT '완독·중단 상태 전환 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- memory_card_groups: 사용자별 암기 카드 묶음
ALTER TABLE `memory_card_groups`
  COMMENT = '사용자별 암기 카드 묶음',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 표시 제목',
  MODIFY COLUMN `description` text COLLATE utf8mb4_unicode_ci COMMENT '암기 카드 묶음 설명',
  MODIFY COLUMN `source_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '카드 내용 출처 표시명',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- memory_cards: 암기 카드 앞면·뒷면·학습 상태
ALTER TABLE `memory_cards`
  COMMENT = '암기 카드 앞면·뒷면·학습 상태',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `group_id` bigint NOT NULL COMMENT '카드 소속 암기 카드 묶음 식별자',
  MODIFY COLUMN `front_text` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '암기 카드 앞면 질문·단어',
  MODIFY COLUMN `back_text` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '암기 카드 뒷면 정답·뜻',
  MODIFY COLUMN `example_text` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '학습 보조 예문',
  MODIFY COLUMN `memo` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '사용자 추가 메모',
  MODIFY COLUMN `memorized` tinyint(1) NOT NULL DEFAULT '0' COMMENT '사용자 암기 완료 표시 여부',
  MODIFY COLUMN `position` int NOT NULL DEFAULT '0' COMMENT '묶음 내 카드 표시 순서',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- messages: 독서 세션 사용자·AI·Persona 대화 메시지
ALTER TABLE `messages`
  COMMENT = '독서 세션 사용자·AI·Persona 대화 메시지',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint NOT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `parent_message_id` bigint DEFAULT NULL COMMENT '답글 상위 메시지 식별자',
  MODIFY COLUMN `role` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '메시지 작성 주체: user·assistant·persona·system',
  MODIFY COLUMN `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '메시지 본문',
  MODIFY COLUMN `content_format` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'markdown' COMMENT '메시지 본문 형식',
  MODIFY COLUMN `message_order` int NOT NULL COMMENT '작업 공간 내 메시지 표시 순서',
  MODIFY COLUMN `ai_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '메시지 생성 AI 모델명',
  MODIFY COLUMN `persona_id` bigint DEFAULT NULL COMMENT '관련 AI 토론 Persona 식별자',
  MODIFY COLUMN `question_id` bigint DEFAULT NULL COMMENT '관련 질문 식별자',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT 'AI 응답 생성용 제한 문맥·참조 ID JSON',
  MODIFY COLUMN `token_usage` json DEFAULT NULL COMMENT 'AI 제공자 보고 입력·출력 토큰 사용량 JSON',
  MODIFY COLUMN `streaming_status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'complete' COMMENT '스트리밍 메시지 생성 진행 상태',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- metrics: 원본 독서 활동 계산·수동 생성 지표
ALTER TABLE `metrics`
  COMMENT = '원본 독서 활동 계산·수동 생성 지표',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `book_id` bigint DEFAULT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `session_id` bigint DEFAULT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint DEFAULT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `question_id` bigint DEFAULT NULL COMMENT '관련 질문 식별자',
  MODIFY COLUMN `persona_id` bigint DEFAULT NULL COMMENT '관련 AI 토론 Persona 식별자',
  MODIFY COLUMN `metric_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '지표 식별명',
  MODIFY COLUMN `metric_scope` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자·도서·세션·작업 공간 등 지표 집계 범위',
  MODIFY COLUMN `metric_period_start` date DEFAULT NULL COMMENT '지표 집계 기간 시작일',
  MODIFY COLUMN `metric_period_end` date DEFAULT NULL COMMENT '지표 집계 기간 종료일',
  MODIFY COLUMN `metric_value` decimal(18,4) DEFAULT NULL COMMENT '계산 지표 수치',
  MODIFY COLUMN `metric_unit` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '지표 수치 단위',
  MODIFY COLUMN `metric_details` json DEFAULT NULL COMMENT '확장형 지표 차원·근거값 JSON',
  MODIFY COLUMN `source_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '지표 생성 원본·작업 참조값',
  MODIFY COLUMN `generated_by` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system' COMMENT '지표 생성 시스템·작업명',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- moderation_daily_aggregates: 비식별 토론 입력 검토 일별 집계
ALTER TABLE `moderation_daily_aggregates`
  COMMENT = '비식별 토론 입력 검토 일별 집계',
  MODIFY COLUMN `aggregate_date` date NOT NULL COMMENT '검토 이벤트 집계 기준일',
  MODIFY COLUMN `decision` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검토 결정: ALLOW·REDIRECT·REJECT',
  MODIFY COLUMN `intent` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 분류 사용자 의도',
  MODIFY COLUMN `reason_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사유 분류 표준 코드',
  MODIFY COLUMN `model` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 AI 모델명',
  MODIFY COLUMN `prompt_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 프롬프트 버전',
  MODIFY COLUMN `fallback_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'AI 실패 시 규칙 기반 대체 판단 사용 여부',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `event_count` bigint NOT NULL DEFAULT '0' COMMENT '해당 분류 전체 검토 이벤트 수',
  MODIFY COLUMN `persona_called_count` bigint NOT NULL DEFAULT '0' COMMENT '검토 후 Persona 응답 호출 수',
  MODIFY COLUMN `related_feedback_count` bigint NOT NULL DEFAULT '0' COMMENT '사용자 관련 평가 수',
  MODIFY COLUMN `not_related_feedback_count` bigint NOT NULL DEFAULT '0' COMMENT '사용자 비관련 평가 수',
  MODIFY COLUMN `latency_sum_ms` bigint NOT NULL DEFAULT '0' COMMENT '평균 계산용 검토 지연시간 합계(밀리초)',
  MODIFY COLUMN `latency_max_ms` int NOT NULL DEFAULT '0' COMMENT '최대 검토 지연시간(밀리초)',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- moderation_events: 토론 입력 허용·전환·거절 판단·라우팅 근거
ALTER TABLE `moderation_events`
  COMMENT = '토론 입력 허용·전환·거절 판단·라우팅 근거',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `request_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 요청 UUID',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `book_id` bigint NOT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint NOT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `message_id` bigint DEFAULT NULL COMMENT '허용 입력 저장 사용자 메시지 식별자',
  MODIFY COLUMN `input_text` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '전환·거절 시 보관 사용자 입력 원문',
  MODIFY COLUMN `decision` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검토 결정: ALLOW·REDIRECT·REJECT',
  MODIFY COLUMN `intent` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 분류 사용자 의도',
  MODIFY COLUMN `relevance_score` decimal(6,5) NOT NULL COMMENT '현재 독서 토론 관련성 점수',
  MODIFY COLUMN `confidence` decimal(6,5) NOT NULL COMMENT '검토 결정 신뢰도 점수',
  MODIFY COLUMN `reason_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사유 분류 표준 코드',
  MODIFY COLUMN `suggested_question` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '전환 결정 사용자 제안 독서 관련 질문',
  MODIFY COLUMN `model` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 AI 모델명',
  MODIFY COLUMN `policy_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '적용 검토 정책 버전',
  MODIFY COLUMN `prompt_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력 검토 프롬프트 버전',
  MODIFY COLUMN `schema_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '구조화 검토 응답 스키마 버전',
  MODIFY COLUMN `latency_ms` int NOT NULL COMMENT '입력 검토 소요 시간(밀리초)',
  MODIFY COLUMN `fallback_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'AI 실패 시 규칙 기반 대체 판단 사용 여부',
  MODIFY COLUMN `routing_outcome` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '검토 후 실제 라우팅 결과',
  MODIFY COLUMN `persona_called` tinyint(1) NOT NULL DEFAULT '0' COMMENT '검토 후 Persona 응답 호출 여부',
  MODIFY COLUMN `provider_error_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 제공자 호출 실패 정규화 오류 코드',
  MODIFY COLUMN `user_feedback` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '사용자 검토 결과 관련성 평가',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '레코드 최종 변경 시각'
;

-- pending_google_registrations: Google 로그인 약관 동의 대기 임시 가입 정보
ALTER TABLE `pending_google_registrations`
  COMMENT = 'Google 로그인 약관 동의 대기 임시 가입 정보',
  MODIFY COLUMN `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문 비저장 토큰 해시값',
  MODIFY COLUMN `provider_subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Google 발급 사용자 고유 식별자',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Google 전달 이메일 주소',
  MODIFY COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Google 이메일 확인 완료 전달 여부',
  MODIFY COLUMN `display_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Google 전달 사용자 표시명',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '레코드·권한 만료 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값 사용·재사용 불가 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- pending_registration_intents: 일반 회원가입 개인정보·AI 이전 동의 의사 임시 저장
ALTER TABLE `pending_registration_intents`
  COMMENT = '일반 회원가입 개인정보·AI 이전 동의 의사 임시 저장',
  MODIFY COLUMN `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문 비저장 토큰 해시값',
  MODIFY COLUMN `privacy_policy_version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '개인정보 처리방침 동의 문서 버전',
  MODIFY COLUMN `ai_transfer_version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '국외 AI 처리 안내 동의 문서 버전',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '레코드·권한 만료 시각',
  MODIFY COLUMN `used_at` timestamp NULL DEFAULT NULL COMMENT '일회성 값 사용·재사용 불가 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- personas: AI 토론 참여자 이름·행동 지침
ALTER TABLE `personas`
  COMMENT = 'AI 토론 참여자 이름·행동 지침',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '코드·API용 Persona 고유 이름',
  MODIFY COLUMN `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 화면 Persona 표시명',
  MODIFY COLUMN `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Persona 관점·역할 설명',
  MODIFY COLUMN `system_prompt` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI Persona 역할 응답 시스템 지침',
  MODIFY COLUMN `tone` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Persona 대표 말투·어조',
  MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '새 토론 선택 가능 활성 Persona 여부',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- questions: 독서 세션 AI 생성·제시 질문
ALTER TABLE `questions`
  COMMENT = '독서 세션 AI 생성·제시 질문',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `window_id` bigint DEFAULT NULL COMMENT '관련 세션 작업 공간 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `question_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 제시 질문 본문',
  MODIFY COLUMN `question_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reflection' COMMENT '성찰·토론 등 질문 종류',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '질문 활성·처리 상태',
  MODIFY COLUMN `ai_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '질문 생성 AI 모델명',
  MODIFY COLUMN `prompt_snapshot` json DEFAULT NULL COMMENT '질문 생성 요청 프롬프트 스냅샷',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT '질문 생성 독서 문맥 JSON',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- reading_sessions: 사용자·도서 연결 독서·성찰 활동 단위
ALTER TABLE `reading_sessions`
  COMMENT = '사용자·도서 연결 독서·성찰 활동 단위',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `book_id` bigint NOT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '독서 세션 제목',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '독서 세션 진행 상태',
  MODIFY COLUMN `is_pinned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '서재 목록 상단 고정 여부',
  MODIFY COLUMN `reading_goal` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '독서 세션 목표',
  MODIFY COLUMN `start_page` int DEFAULT NULL COMMENT '세션 시작 페이지',
  MODIFY COLUMN `current_page` int DEFAULT NULL COMMENT '현재 독서 페이지',
  MODIFY COLUMN `target_page` int DEFAULT NULL COMMENT '목표 마지막 페이지',
  MODIFY COLUMN `progress_note` text COLLATE utf8mb4_unicode_ci COMMENT '독서 진행 상황 사용자 메모',
  MODIFY COLUMN `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '독서 세션 시작 시각',
  MODIFY COLUMN `completed_at` timestamp NULL DEFAULT NULL COMMENT '독서 세션 완료 시각',
  MODIFY COLUMN `summary` text COLLATE utf8mb4_unicode_ci COMMENT '독서 세션 전체 요약',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT '세션 문맥 재구성 확장 JSON',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- refresh_tokens: 로그인 세션 갱신 토큰 해시·폐기 상태
ALTER TABLE `refresh_tokens`
  COMMENT = '로그인 세션 갱신 토큰 해시·폐기 상태',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '원문 비저장 refresh token SHA-256 해시',
  MODIFY COLUMN `jti` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'refresh token JWT 고유 식별자',
  MODIFY COLUMN `expires_at` timestamp NOT NULL COMMENT '레코드·권한 만료 시각',
  MODIFY COLUMN `revoked_at` timestamp NULL DEFAULT NULL COMMENT 'refresh token 폐기 시각',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각'
;

-- review_comments: 공개 독서 리뷰 댓글·1단계 답글
ALTER TABLE `review_comments`
  COMMENT = '공개 독서 리뷰 댓글·1단계 답글',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `insight_id` bigint NOT NULL COMMENT '댓글 대상 공개 리뷰 통찰 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `parent_comment_id` bigint DEFAULT NULL COMMENT '답글 상위 댓글 식별자',
  MODIFY COLUMN `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '댓글·답글 본문',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- schema_migrations: DB 마이그레이션 적용 파일·체크섬 이력
ALTER TABLE `schema_migrations`
  COMMENT = 'DB 마이그레이션 적용 파일·체크섬 이력',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '파일명 추출 마이그레이션 버전',
  MODIFY COLUMN `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '적용 마이그레이션 파일명',
  MODIFY COLUMN `checksum_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '적용 당시 마이그레이션 파일 SHA-256 체크섬',
  MODIFY COLUMN `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '마이그레이션 적용 완료 시각'
;

-- session_highlights: 독서 세션 인용문·근거 메모
ALTER TABLE `session_highlights`
  COMMENT = '독서 세션 인용문·근거 메모',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `book_id` bigint NOT NULL COMMENT '관련 도서 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `page_number` int DEFAULT NULL COMMENT '인용문 도서 페이지',
  MODIFY COLUMN `location_label` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '전자책 위치 등 페이지 외 위치 표시',
  MODIFY COLUMN `quote_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 저장 도서 인용문',
  MODIFY COLUMN `note` text COLLATE utf8mb4_unicode_ci COMMENT '사용자 인용문 메모',
  MODIFY COLUMN `highlight_order` int NOT NULL COMMENT '세션 내 인용문 표시 순서',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- session_insights: 독서 세션 답변·감상·핵심 통찰·공개 리뷰
ALTER TABLE `session_insights`
  COMMENT = '독서 세션 답변·감상·핵심 통찰·공개 리뷰',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `question_id` bigint DEFAULT NULL COMMENT '답변·통찰 출발 질문 식별자',
  MODIFY COLUMN `insight_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'takeaway' COMMENT '핵심 정리·질문 답변 등 통찰 종류',
  MODIFY COLUMN `title` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '통찰·공개 리뷰 제목',
  MODIFY COLUMN `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 작성 통찰·답변·리뷰 본문',
  MODIFY COLUMN `summary` text COLLATE utf8mb4_unicode_ci COMMENT 'AI 생성 통찰 본문 요약',
  MODIFY COLUMN `summary_source_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '요약 대상 본문 변경 확인 SHA-256 해시',
  MODIFY COLUMN `summary_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '요약 생성 AI 모델명',
  MODIFY COLUMN `summary_token_usage` json DEFAULT NULL COMMENT '요약 생성 제공자 보고 토큰 사용량 JSON',
  MODIFY COLUMN `summarized_at` timestamp NULL DEFAULT NULL COMMENT '현재 요약 생성 시각',
  MODIFY COLUMN `summary_status` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '요약 생성 현재 상태',
  MODIFY COLUMN `evidence` text COLLATE utf8mb4_unicode_ci COMMENT '통찰 뒷받침 인용·근거',
  MODIFY COLUMN `author_name` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '공개 리뷰 작성자 표시명',
  MODIFY COLUMN `visibility` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PRIVATE' COMMENT '공개 범위: PRIVATE·PUBLIC',
  MODIFY COLUMN `reviewed_on` date DEFAULT NULL COMMENT '사용자 지정 리뷰 작성일',
  MODIFY COLUMN `insight_order` int NOT NULL COMMENT '세션 내 통찰 표시 순서',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태',
  MODIFY COLUMN `active_question_id` bigint GENERATED ALWAYS AS ((case when (`deleted_at` is null) then `question_id` else NULL end)) STORED COMMENT '활성 질문 답변 유일성 보장 생성값'
;

-- session_tags: 독서 세션 사용자 분류 태그
ALTER TABLE `session_tags`
  COMMENT = '독서 세션 사용자 분류 태그',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 입력 세션 분류 태그명',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- session_windows: 독서 세션 질문·성찰·토론 작업 공간
ALTER TABLE `session_windows`
  COMMENT = '독서 세션 질문·성찰·토론 작업 공간',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `session_id` bigint NOT NULL COMMENT '관련 독서 세션 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `source_question_id` bigint DEFAULT NULL COMMENT '연관 토론 작업 공간 출발 질문 식별자',
  MODIFY COLUMN `window_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '질문·성찰·토론 등 작업 공간 종류',
  MODIFY COLUMN `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '작업 공간 제목',
  MODIFY COLUMN `position` int NOT NULL DEFAULT '0' COMMENT '세션 내 작업 공간 표시 순서',
  MODIFY COLUMN `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open' COMMENT '작업 공간 열림·완료 진행 상태',
  MODIFY COLUMN `context_snapshot` json DEFAULT NULL COMMENT '대화 요약 등 재생성 가능 작업 공간 문맥 JSON',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태',
  MODIFY COLUMN `active_source_question_id` bigint GENERATED ALWAYS AS ((case when ((`deleted_at` is null) and (`window_type` = _utf8mb4'debate')) then `source_question_id` else NULL end)) STORED COMMENT '활성 연관 토론 유일성 보장 생성값'
;

-- shell_crawler_saves: ShellCrawler 사용자별 클라우드 이어하기 상태
ALTER TABLE `shell_crawler_saves`
  COMMENT = 'ShellCrawler 사용자별 클라우드 이어하기 상태',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `slot_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자별 저장 슬롯 구분 키',
  MODIFY COLUMN `schema_version` int NOT NULL COMMENT '저장 데이터 구조 버전',
  MODIFY COLUMN `app_version` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '저장 데이터 생성 애플리케이션 버전',
  MODIFY COLUMN `client_save_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '클라이언트 생성 저장 요청 고유 식별자',
  MODIFY COLUMN `client_saved_at` timestamp NOT NULL COMMENT '클라이언트 게임 상태 저장 시각',
  MODIFY COLUMN `summary_json` json NOT NULL COMMENT '이어하기 화면 요약 상태 JSON',
  MODIFY COLUMN `state_json` json NOT NULL COMMENT '게임 복원 전체 상태 JSON',
  MODIFY COLUMN `payload_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '저장 payload 무결성 확인용 SHA-256 체크섬',
  MODIFY COLUMN `revision` int NOT NULL DEFAULT '1' COMMENT '낙관적 동시성 제어용 저장 개정 번호',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;

-- user_consent_events: 사용자 약관 동의·철회 불변 이벤트
ALTER TABLE `user_consent_events`
  COMMENT = '사용자 약관 동의·철회 불변 이벤트',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `consent_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '개인정보 처리·AI 이전 동의 종류',
  MODIFY COLUMN `document_version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의·철회 대상 문서 버전',
  MODIFY COLUMN `event_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의·철회 이벤트 종류',
  MODIFY COLUMN `registration_channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '동의 발생 가입 경로: LOCAL·GOOGLE',
  MODIFY COLUMN `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '동의·철회 이벤트 발생 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부'
;

-- user_memberships: 사용자별 무료·프리미엄 이용 등급·유효기간
ALTER TABLE `user_memberships`
  COMMENT = '사용자별 무료·프리미엄 이용 등급·유효기간',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '이용 등급 대상 사용자 식별자',
  MODIFY COLUMN `tier` enum('FREE','PREMIUM') NOT NULL DEFAULT 'FREE' COMMENT '현재 이용 등급: FREE·PREMIUM',
  MODIFY COLUMN `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '현재 이용 등급 부여 시각',
  MODIFY COLUMN `expires_at` datetime DEFAULT NULL COMMENT '이용 등급 만료 시각·NULL 무기한',
  MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- user_oauth_identities: 사용자 계정·외부 로그인 식별자 연결
ALTER TABLE `user_oauth_identities`
  COMMENT = '사용자 계정·외부 로그인 식별자 연결',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '레코드 소유·연관 사용자 식별자',
  MODIFY COLUMN `provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'google 등 외부 로그인 제공자 코드',
  MODIFY COLUMN `provider_subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '외부 로그인 제공자 발급 사용자 고유 식별자',
  MODIFY COLUMN `provider_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '외부 로그인 제공자 전달 이메일 주소',
  MODIFY COLUMN `linked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '외부 로그인 식별자·사용자 계정 연결 시각',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각'
;

-- users: 로그인 사용자 계정·인증·탈퇴·개인정보 파기 상태
ALTER TABLE `users`
  COMMENT = '로그인 사용자 계정·인증·탈퇴·개인정보 파기 상태',
  MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '레코드 고유 식별자',
  MODIFY COLUMN `username` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '로그인용 불변 사용자명',
  MODIFY COLUMN `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '로그인·알림용 이메일 주소',
  MODIFY COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT '0' COMMENT '사용자 이메일 확인 완료 여부',
  MODIFY COLUMN `display_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '서비스 화면 사용자 표시명',
  MODIFY COLUMN `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '로컬 로그인 비밀번호 BCrypt 해시',
  MODIFY COLUMN `auth_provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local' COMMENT '계정 생성 인증 방식: local·google',
  MODIFY COLUMN `account_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '계정 생명주기 상태: ACTIVE·RESIGNED·PURGED',
  MODIFY COLUMN `resigned_at` timestamp NULL DEFAULT NULL COMMENT '사용자 회원 탈퇴 확정 시각',
  MODIFY COLUMN `personal_data_purge_scheduled_at` timestamp NULL DEFAULT NULL COMMENT '개인정보 파기 예정 시각',
  MODIFY COLUMN `personal_data_purged_at` timestamp NULL DEFAULT NULL COMMENT '개인정보 파기 완료 시각',
  MODIFY COLUMN `credentials_version` bigint NOT NULL DEFAULT '1' COMMENT '기존 인증 수단 일괄 무효화 버전',
  MODIFY COLUMN `erase_activity_on_purge` tinyint(1) NOT NULL DEFAULT '0' COMMENT '개인정보 파기 시 독서 활동 동시 삭제 여부',
  MODIFY COLUMN `failed_login_count` int NOT NULL DEFAULT '0' COMMENT '연속 로그인 실패 횟수',
  MODIFY COLUMN `locked_until` timestamp NULL DEFAULT NULL COMMENT '로그인 잠금 해제 시각',
  MODIFY COLUMN `last_login_at` timestamp NULL DEFAULT NULL COMMENT '마지막 로그인 성공 시각',
  MODIFY COLUMN `is_test_data` tinyint(1) NOT NULL DEFAULT '0' COMMENT '로컬·테스트 전용 데이터 여부',
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '레코드 생성 시각',
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '레코드 최종 변경 시각',
  MODIFY COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제 시각·NULL 활성 상태'
;
