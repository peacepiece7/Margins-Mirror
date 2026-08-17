-- 사용자의 primary Reflection과 Interview·Guide·Run 진행 상태를 점검한다.
SELECT
  si.id AS reflection_id,
  si.session_id,
  rr.id AS current_revision_id,
  rr.version AS current_revision_version,
  ri.id AS interview_id,
  ri.status AS interview_status,
  ri.answered_count,
  ri.generated_count,
  dg.id AS guide_id,
  dg.guide_version,
  dg.origin AS guide_origin,
  dg.purpose AS guide_purpose,
  dg.audience_mode,
  dg.target_minutes,
  dg.disclosure_mode,
  dg.depth AS guide_depth,
  dr.id AS run_id,
  dr.guide_id AS run_guide_id,
  dr.status AS run_status,
  dr.refinement_outcome,
  dr.refinement_suggestion_status,
  dr.refinement_input_hash,
  dr.refinement_transcript_hash,
  dr.refinement_prompt_version,
  dr.refinement_generated_at
FROM session_insights si
LEFT JOIN reflection_revisions rr ON rr.id = (
  SELECT latest.id
  FROM reflection_revisions latest
  WHERE latest.reflection_insight_id = si.id
  ORDER BY latest.version DESC
  LIMIT 1
)
LEFT JOIN reflection_interviews ri
  ON ri.source_revision_id = rr.id
  AND ri.status IN ('ACTIVE', 'GUIDE_READY')
LEFT JOIN discussion_guides dg
  ON dg.interview_id = ri.id
  AND dg.is_current = TRUE
LEFT JOIN discussion_runs dr ON dr.id = (
  SELECT latest_run.id
  FROM discussion_runs latest_run
  INNER JOIN discussion_guides run_guide
    ON run_guide.id = latest_run.guide_id
  WHERE run_guide.interview_id = ri.id
    AND latest_run.user_id = si.user_id
  ORDER BY
    CASE latest_run.status
      WHEN 'ACTIVE' THEN 0
      WHEN 'READY' THEN 1
      ELSE 2
    END,
    latest_run.created_at DESC,
    latest_run.id DESC
  LIMIT 1
)
WHERE si.user_id = ?
  AND si.insight_type = 'reflection'
  AND si.deleted_at IS NULL
ORDER BY si.updated_at DESC, si.id DESC;
