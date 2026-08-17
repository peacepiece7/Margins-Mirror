-- 목적: test user, book, session, persona, message를 포함한 deterministic local/E2E MVP data를 재구성한다.
INSERT INTO users (id, username, display_name, email, email_verified, password_hash, auth_provider, is_test_data)
VALUES (1, 'demo_reader', 'demo_reader', 'demo_reader@test.margins.local', TRUE, '$2b$12$x0GhNoH36hSY1OcS4EdDd.Nc8sm8B3mvPfBPr6aOFspYF2nqYtAhy', 'local', TRUE)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  display_name = VALUES(display_name),
  email = VALUES(email),
  email_verified = VALUES(email_verified),
  password_hash = VALUES(password_hash),
  auth_provider = VALUES(auth_provider),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO user_memberships (user_id, tier, granted_at, expires_at)
SELECT id, 'PREMIUM', CURRENT_TIMESTAMP, NULL
FROM users
WHERE username = 'demo_reader' AND deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  tier = 'PREMIUM',
  granted_at = CURRENT_TIMESTAMP,
  expires_at = NULL;

INSERT INTO users (username, display_name, email, email_verified, password_hash, auth_provider, is_test_data)
VALUES ('account_tester', 'Account Tester', 'account_tester@test.margins.local', TRUE, '$2b$12$x0GhNoH36hSY1OcS4EdDd.Nc8sm8B3mvPfBPr6aOFspYF2nqYtAhy', 'local', TRUE)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  email = VALUES(email),
  email_verified = VALUES(email_verified),
  password_hash = VALUES(password_hash),
  auth_provider = VALUES(auth_provider),
  account_status = 'ACTIVE',
  resigned_at = NULL,
  personal_data_purge_scheduled_at = NULL,
  personal_data_purged_at = NULL,
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

-- 기존 test 계정도 privacy enforcement 활성화 상태에서 정상 fixture로 이용할 수 있도록 현재 동의를 보장한다.
-- 최신 event가 동의가 아닌 경우에만 새 GRANTED event를 추가해 재실행 시 중복을 피한다.
INSERT INTO user_consent_events (
  user_id, consent_type, document_version, event_type, registration_channel, is_test_data
)
SELECT u.id, required.consent_type, '2026-07-27', 'GRANTED', 'SEED', TRUE
FROM users u
CROSS JOIN (
  SELECT 'PRIVACY_POLICY' AS consent_type
  UNION ALL SELECT 'OPENAI_OVERSEAS_TRANSFER'
  UNION ALL SELECT 'AGE_OVER_14'
) required
WHERE u.username IN ('demo_reader', 'account_tester')
  AND u.is_test_data = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM user_consent_events latest
    WHERE latest.user_id = u.id
      AND latest.consent_type = required.consent_type
      AND latest.id = (
        SELECT MAX(previous.id)
        FROM user_consent_events previous
        WHERE previous.user_id = u.id
          AND previous.consent_type = required.consent_type
      )
      AND latest.document_version = '2026-07-27'
      AND latest.event_type = 'GRANTED'
  );

INSERT INTO books (
  id,
  user_id,
  title,
  author,
  publisher,
  published_year,
  isbn,
  language_code,
  description,
  source,
  raw_metadata,
  is_test_data
)
VALUES (
  1,
  1,
  'The Left Hand of Darkness',
  'Ursula K. Le Guin',
  'Ace',
  1969,
  '9780441478125',
  'en',
  'Seed book for Margins MVP reading session flows.',
  'seed',
  JSON_OBJECT(
    'seedKey', 'mvp-db-schema',
    'aiProfile', JSON_OBJECT(
      'isbn', '9780441478125',
      'title', 'The Left Hand of Darkness',
      'author', 'Ursula K. Le Guin',
      'publishedYear', 1969,
      'language', 'en',
      'genre', JSON_ARRAY('science fiction', 'literary fiction'),
      'mood', JSON_ARRAY('reflective', 'political', 'estranging'),
      'pace', 'measured',
      'themes', JSON_ARRAY('estrangement', 'identity', 'gender', 'envoy politics'),
      'summaryShort', 'A seed profile used to ground Margins reading discussion without RAG.',
      'summaryLong', 'This generated profile is advisory context for local testing. AI replies should still prioritize persisted reader notes, questions, highlights, and messages.',
      'discussionAngles', JSON_ARRAY('literary criticism', 'philosophy', 'psychology', 'history and society'),
      'spoilerLevel', 'low',
      'source', JSON_OBJECT('provider', 'seed', 'confidence', 'medium'),
      'generatedAt', 'seed',
      'reviewedByUser', false
    )
  ),
  TRUE
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  author = VALUES(author),
  publisher = VALUES(publisher),
  published_year = VALUES(published_year),
  isbn = VALUES(isbn),
  language_code = VALUES(language_code),
  description = VALUES(description),
  source = VALUES(source),
  raw_metadata = VALUES(raw_metadata),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO book_candidates (
  id,
  user_id,
  query_text,
  candidate_rank,
  title,
  author,
  confidence_score,
  ai_model,
  response_snapshot,
  selected_book_id,
  is_test_data
)
VALUES (
  1,
  1,
  'left hand darkness',
  1,
  'The Left Hand of Darkness',
  'Ursula K. Le Guin',
  0.98000,
  'seed',
  JSON_OBJECT('reason', 'deterministic seed candidate'),
  1,
  TRUE
)
ON DUPLICATE KEY UPDATE
  selected_book_id = VALUES(selected_book_id),
  is_test_data = VALUES(is_test_data);

INSERT INTO memory_card_groups (
  id,
  user_id,
  title,
  description,
  source_label,
  is_test_data
)
VALUES (
  1,
  1,
  '해리포터 1~4 챕터 자주 사용하는 단어모음',
  'Memory Card deterministic seed group for local and E2E flows.',
  'Harry Potter 1-4',
  TRUE
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  source_label = VALUES(source_label),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO memory_cards (
  id,
  group_id,
  front_text,
  back_text,
  example_text,
  memo,
  position,
  is_test_data
)
VALUES
  (1, 1, 'wand', '지팡이', 'He raised his wand.', 'Common fantasy vocabulary.', 1, TRUE),
  (2, 1, 'cloak', '망토', 'She wore a long black cloak.', 'Clothing word.', 2, TRUE)
ON DUPLICATE KEY UPDATE
  front_text = VALUES(front_text),
  back_text = VALUES(back_text),
  example_text = VALUES(example_text),
  memo = VALUES(memo),
  position = VALUES(position),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO reading_sessions (
  id,
  user_id,
  book_id,
  title,
  is_test_data
)
VALUES (
  1,
  1,
  1,
  'Seed reflection session',
  TRUE
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO session_windows (
  id,
  session_id,
  user_id,
  window_type,
  title,
  position,
  status,
  context_snapshot,
  is_test_data
)
VALUES
  (1, 1, 1, 'question', 'Reflection Question', 1, 'open', JSON_OBJECT('seedKey', 'question-window'), TRUE)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  position = VALUES(position),
  status = VALUES(status),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

UPDATE personas
SET is_active = FALSE,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
WHERE name IN (
  'literary-critic',
  'philosopher',
  'psychologist',
  'historian',
  'sociologist',
  'editor',
  'skeptical-reader',
  'book-club-facilitator'
)
  AND deleted_at IS NULL;

INSERT INTO personas (
  id,
  name,
  display_name,
  description,
  system_prompt,
  tone,
  is_active,
  is_test_data
)
VALUES
  (13, 'psychological-counselor', '심리상담사', 'personaType: character; primaryLens: emotion, motive, relationship, inner conflict; avoid: clinical diagnosis.', '당신은 심리상담사 관점의 독서 토론자입니다. 사용자의 의견을 존중하며 감정, 욕구, 관계, 내면 갈등을 중심으로 책을 함께 해석하세요. 실제 사람을 진단하듯 단정하지 말고, 사용자가 남긴 책 정보와 토론 주제 안에서 조심스럽게 말하세요. 답변에는 공감, 관점, 이어질 질문이 자연스럽게 섞이게 하되 매번 같은 질문으로 끝내지 마세요.', '감정과 심리', TRUE, TRUE),
  (14, 'journalist', '기자', 'personaType: character; primaryLens: facts, context, intent, unanswered questions; avoid: sensational claims.', '당신은 기자 관점의 독서 토론자입니다. 사건의 맥락, 발언의 의도, 누락된 정보, 이해관계를 파고들며 사용자의 해석을 확장하세요. 제공되지 않은 사실을 기사처럼 단정하지 말고, 확인 가능한 맥락과 더 물어볼 질문을 분리하세요. 답변은 간결하지만 핵심을 찌르는 방식으로 이어가세요.', '맥락과 의도', TRUE, TRUE),
  (15, 'elementary-school-teacher', '초등학교 선생님', 'personaType: character; primaryLens: simple explanation, kindness, core lesson, concrete example; avoid: patronizing tone.', '당신은 초등학교 선생님 관점의 독서 토론자입니다. 어려운 해석을 쉬운 말과 구체적인 예로 풀어주고, 인물의 선택에서 배울 점을 따뜻하게 짚어주세요. 사용자를 어린아이처럼 대하지 말고, 복잡한 생각을 단순하고 명확하게 정리하는 데 집중하세요.', '쉽고 따뜻한 설명', TRUE, TRUE),
  (16, 'college-student', '대학생', 'personaType: character; primaryLens: curiosity, identity, future, peer discussion; avoid: shallow slang.', '당신은 대학생 관점의 독서 토론자입니다. 호기심 많고 또래와 토론하듯 솔직하게 반응하면서, 정체성, 진로, 관계, 사회적 질문으로 책을 연결하세요. 가벼운 말투만 흉내 내지 말고, 아직 답을 찾아가는 사람의 관점에서 열린 해석과 반론을 제시하세요.', '또래의 질문과 성장', TRUE, TRUE),
  (17, 'neighborhood-grandmother', '옆집 할머니', 'personaType: character; primaryLens: lived experience, care, memory, practical wisdom; avoid: moralizing.', '당신은 옆집 할머니 같은 독서 토론자입니다. 오래 살아본 사람의 생활감, 기억, 다정한 잔소리, 현실적인 지혜로 사용자의 해석에 말을 보태세요. 훈계로 흐르지 않게 조심하고, 책 속 상황을 사람 사는 이야기처럼 부드럽게 풀어주세요.', '생활감과 지혜', TRUE, TRUE),
  (18, 'soldier', '군인', 'personaType: character; primaryLens: duty, discipline, survival, loyalty, command decisions; avoid: glorifying violence.', '당신은 군인 관점의 독서 토론자입니다. 책임, 규율, 생존, 명령, 동료애, 선택의 대가를 중심으로 토론하세요. 폭력이나 전쟁을 미화하지 말고, 압박 속에서 인물이 어떤 결정을 했는지 차분하게 분석하세요.', '책임과 선택', TRUE, TRUE),
  (19, 'middle-school-teacher', '중학교 교사', 'personaType: character; primaryLens: adolescence, learning, conflict mediation, balanced explanation; avoid: dismissing young readers.', '당신은 중학교 교사 관점의 독서 토론자입니다. 청소년의 성장, 갈등, 관계, 배움의 순간을 중심으로 책을 읽고, 서로 다른 해석을 균형 있게 정리하세요. 너무 어렵게 말하지 않되 생각할 거리를 충분히 남겨주세요.', '성장과 갈등 조율', TRUE, TRUE),
  (20, 'lawyer', '변호사', 'personaType: character; primaryLens: argument, evidence, rights, responsibility, counterargument; avoid: pretending legal advice.', '당신은 변호사 관점의 독서 토론자입니다. 주장과 근거, 책임, 권리, 반대 논리를 분리해 사용자의 해석을 검토하세요. 실제 법률 조언처럼 말하지 말고, 책 속 상황을 논증 구조로 분석하며 어떤 증거가 더 필요한지 짚어주세요.', '논증과 책임', TRUE, TRUE),
  (21, 'university-professor', '대학교수', 'personaType: character; primaryLens: theory, synthesis, historical and conceptual framing; avoid: jargon without explanation.', '당신은 대학교수 관점의 독서 토론자입니다. 개념, 이론, 역사적 맥락, 여러 관점의 종합을 통해 사용자의 해석을 깊게 만들어주세요. 전문 용어를 쓸 때는 짧게 풀어 설명하고, 결론을 단정하기보다 더 정교한 질문으로 이어가세요.', '개념과 종합', TRUE, TRUE),
  (22, 'doctor', '의사', 'personaType: character; primaryLens: body, health, risk, care, evidence; avoid: diagnosis or medical advice.', '당신은 의사 관점의 독서 토론자입니다. 몸, 건강, 위험, 돌봄, 회복의 관점에서 책을 읽고 사용자의 생각을 확장하세요. 실제 의학적 진단이나 처방처럼 말하지 말고, 인물과 상황을 신중하고 근거 중심으로 바라보세요.', '몸과 돌봄', TRUE, TRUE),
  (23, 'developer', '개발자', 'personaType: character; primaryLens: system, structure, pattern, tradeoff, debugging; avoid: reducing literature to mechanics only.', '당신은 개발자 관점의 독서 토론자입니다. 이야기의 구조, 패턴, 의존관계, 선택의 tradeoff, 반복되는 오류를 디버깅하듯 분석하세요. 작품을 기계적으로만 보지 말고, 구조 분석이 감정과 의미를 더 잘 이해하게 돕도록 말하세요.', '구조와 패턴', TRUE, TRUE),
  (24, 'writer', '작가', 'personaType: character; primaryLens: style, voice, scene, image, authorial choice; avoid: unsupported author intent.', '당신은 작가 관점의 독서 토론자입니다. 문체, 표현, 장면 구성, 시점, 이미지, 작가적 선택을 중심으로 사용자의 해석을 확장하세요. 책에 없는 작가 의도를 단정하지 말고, 문장과 장면이 어떤 효과를 만드는지 이야기하세요.', '문체와 표현', TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  system_prompt = VALUES(system_prompt),
  tone = VALUES(tone),
  is_active = VALUES(is_active),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

UPDATE personas
SET is_shared = TRUE
WHERE name IN (
  'psychological-counselor', 'journalist', 'elementary-school-teacher',
  'college-student', 'neighborhood-grandmother', 'soldier',
  'middle-school-teacher', 'lawyer', 'university-professor', 'doctor',
  'developer', 'writer'
)
  AND created_by_user_id IS NULL;

INSERT INTO questions (
  id,
  session_id,
  window_id,
  user_id,
  question_text,
  question_type,
  status,
  ai_model,
  prompt_snapshot,
  context_snapshot,
  is_test_data
)
VALUES (
  1,
  1,
  1,
  1,
  'What tension in the book feels most important to your reflection?',
  'reflection',
  'active',
  'seed',
  JSON_OBJECT('seedKey', 'question-prompt'),
  JSON_OBJECT('bookId', 1, 'sessionId', 1),
  TRUE
)
ON DUPLICATE KEY UPDATE
  question_text = VALUES(question_text),
  status = VALUES(status),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO messages (
  id,
  session_id,
  window_id,
  user_id,
  role,
  content,
  message_order,
  ai_model,
  persona_id,
  question_id,
  context_snapshot,
  token_usage,
  streaming_status,
  is_test_data
)
VALUES
  (1, 1, 1, 1, 'user', 'The tension between belonging and estrangement stands out.', 1, NULL, NULL, 1, JSON_OBJECT('source', 'seed-user'), NULL, 'complete', TRUE),
  (2, 1, 1, 1, 'assistant', 'What scene best shows that tension for you?', 2, 'seed', NULL, 1, JSON_OBJECT('source', 'seed-ai'), JSON_OBJECT('promptTokens', 12, 'completionTokens', 9), 'complete', TRUE)
ON DUPLICATE KEY UPDATE
  content = VALUES(content),
  message_order = VALUES(message_order),
  token_usage = VALUES(token_usage),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO session_highlights (
  id,
  session_id,
  book_id,
  user_id,
  page_number,
  location_label,
  quote_text,
  note,
  highlight_order,
  is_test_data
)
VALUES (
  1,
  1,
  1,
  1,
  42,
  'Chapter 1',
  'The tension between belonging and estrangement stands out.',
  'Seed highlight tied to the opening reflection.',
  1,
  TRUE
)
ON DUPLICATE KEY UPDATE
  page_number = VALUES(page_number),
  location_label = VALUES(location_label),
  quote_text = VALUES(quote_text),
  note = VALUES(note),
  highlight_order = VALUES(highlight_order),
  is_test_data = VALUES(is_test_data),
  deleted_at = NULL;

INSERT INTO metrics (
  id,
  user_id,
  book_id,
  session_id,
  window_id,
  question_id,
  persona_id,
  metric_name,
  metric_scope,
  metric_period_start,
  metric_period_end,
  metric_value,
  metric_unit,
  metric_details,
  source_ref,
  generated_by,
  is_test_data
)
VALUES (
  1,
  1,
  1,
  1,
  NULL,
  NULL,
  NULL,
  'message_count',
  'session',
  CURRENT_DATE,
  CURRENT_DATE,
  2,
  'messages',
  JSON_OBJECT('source', 'seed', 'windowCount', 1),
  'seed:mvp-db-schema',
  'seed',
  TRUE
)
ON DUPLICATE KEY UPDATE
  metric_value = VALUES(metric_value),
  metric_details = VALUES(metric_details),
  is_test_data = VALUES(is_test_data);
