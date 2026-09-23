-- 목적: session-scope metric snapshot 산출에 쓰는 source count를 미리 확인한다.
-- 대상 사용자의 artifact를 session별 한 행으로 먼저 집계해 collection 간 JOIN 곱을 만들지 않는다.
WITH target_sessions AS (
  SELECT rs.user_id, rs.book_id, rs.id AS session_id
  FROM reading_sessions rs
  INNER JOIN books b
    ON b.id = rs.book_id
   AND b.user_id = rs.user_id
   AND b.deleted_at IS NULL
  WHERE rs.user_id = ?
    AND rs.deleted_at IS NULL
),
active_windows AS (
  SELECT sw.id, sw.session_id
  FROM session_windows sw
  INNER JOIN target_sessions ts ON ts.session_id = sw.session_id
  WHERE sw.deleted_at IS NULL
),
window_counts AS (
  SELECT session_id, COUNT(*) AS window_count
  FROM active_windows
  GROUP BY session_id
),
active_questions AS (
  SELECT q.id, q.session_id
  FROM questions q
  INNER JOIN target_sessions ts ON ts.session_id = q.session_id
  LEFT JOIN active_windows aw ON aw.id = q.window_id
  WHERE q.deleted_at IS NULL
    AND (q.window_id IS NULL OR aw.id IS NOT NULL)
),
question_counts AS (
  SELECT session_id, COUNT(*) AS question_count
  FROM active_questions
  GROUP BY session_id
),
active_messages AS (
  SELECT m.session_id, m.question_id, m.persona_id, m.role, m.created_at
  FROM messages m
  INNER JOIN active_windows aw ON aw.id = m.window_id
  WHERE m.deleted_at IS NULL
),
message_counts AS (
  SELECT
    session_id,
    COUNT(*) AS message_count,
    COUNT(DISTINCT persona_id) AS persona_count,
    MIN(created_at) AS first_message_at,
    MAX(created_at) AS last_message_at
  FROM active_messages
  GROUP BY session_id
),
answered_questions AS (
  SELECT m.session_id, m.question_id
  FROM active_messages m
  INNER JOIN active_questions q
    ON q.id = m.question_id
   AND q.session_id = m.session_id
  WHERE m.role = 'user'
    AND m.question_id IS NOT NULL
  UNION
  SELECT si.session_id, si.question_id
  FROM session_insights si
  INNER JOIN active_questions q
    ON q.id = si.question_id
   AND q.session_id = si.session_id
  WHERE si.insight_type = 'question_answer'
    AND si.question_id IS NOT NULL
    AND si.deleted_at IS NULL
),
answer_counts AS (
  SELECT session_id, COUNT(*) AS answered_question_count
  FROM answered_questions
  GROUP BY session_id
),
highlight_counts AS (
  SELECT h.session_id, COUNT(*) AS highlight_count
  FROM session_highlights h
  INNER JOIN target_sessions ts ON ts.session_id = h.session_id
  WHERE h.deleted_at IS NULL
  GROUP BY h.session_id
)
SELECT
  ts.user_id,
  ts.book_id,
  ts.session_id,
  COALESCE(wc.window_count, 0) AS window_count,
  COALESCE(qc.question_count, 0) AS question_count,
  COALESCE(ac.answered_question_count, 0) AS answered_question_count,
  COALESCE(hc.highlight_count, 0) AS highlight_count,
  COALESCE(mc.message_count, 0) AS message_count,
  COALESCE(mc.persona_count, 0) AS persona_count,
  mc.first_message_at,
  mc.last_message_at
FROM target_sessions ts
LEFT JOIN window_counts wc ON wc.session_id = ts.session_id
LEFT JOIN question_counts qc ON qc.session_id = ts.session_id
LEFT JOIN answer_counts ac ON ac.session_id = ts.session_id
LEFT JOIN highlight_counts hc ON hc.session_id = ts.session_id
LEFT JOIN message_counts mc ON mc.session_id = ts.session_id
ORDER BY ts.session_id;
