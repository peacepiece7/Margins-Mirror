package com.margins.reflectionloop.mapper;

import com.margins.reflectionloop.model.MobileReflectionThreadRecord;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MobileReflectionThreadMapper {

    @Select("""
        WITH ranked_sessions AS (
          SELECT rs.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY rs.book_id
                   ORDER BY rs.updated_at DESC, rs.id DESC
                 ) AS row_num
          FROM reading_sessions rs
          WHERE rs.user_id = #{userId}
            AND rs.deleted_at IS NULL
        ),
        primary_reflections AS (
          SELECT si.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY si.session_id
                   ORDER BY si.updated_at DESC, si.id DESC
                 ) AS row_num
          FROM session_insights si
          INNER JOIN ranked_sessions rs
            ON rs.id = si.session_id AND rs.row_num = 1
          WHERE si.user_id = #{userId}
            AND si.insight_type = 'reflection'
            AND si.deleted_at IS NULL
        ),
        ranked_revisions AS (
          SELECT rr.*,
                 COUNT(*) OVER (PARTITION BY rr.reflection_insight_id) AS revision_count,
                 ROW_NUMBER() OVER (
                   PARTITION BY rr.reflection_insight_id
                   ORDER BY rr.version DESC, rr.id DESC
                 ) AS row_num
          FROM reflection_revisions rr
          INNER JOIN primary_reflections pr
            ON pr.id = rr.reflection_insight_id AND pr.row_num = 1
          WHERE rr.user_id = #{userId}
        ),
        active_interviews AS (
          SELECT ri.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY ri.source_revision_id
                   ORDER BY ri.id DESC
                 ) AS row_num
          FROM reflection_interviews ri
          INNER JOIN ranked_revisions rr
            ON rr.id = ri.source_revision_id AND rr.row_num = 1
          WHERE ri.user_id = #{userId}
            AND ri.status IN ('ACTIVE', 'GUIDE_READY')
        ),
        current_questions AS (
          SELECT q.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY q.reflection_interview_id
                   ORDER BY q.id ASC
                 ) AS row_num
          FROM questions q
          INNER JOIN active_interviews ai
            ON ai.id = q.reflection_interview_id AND ai.row_num = 1
          WHERE q.user_id = #{userId}
            AND q.status = 'active'
            AND q.deleted_at IS NULL
        ),
        current_guides AS (
          SELECT dg.*
          FROM discussion_guides dg
          INNER JOIN active_interviews ai
            ON ai.id = dg.interview_id AND ai.row_num = 1
          WHERE dg.user_id = #{userId}
            AND dg.is_current = TRUE
        ),
        prioritized_runs AS (
          SELECT dr.*,
                 dg.interview_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY dg.interview_id
                   ORDER BY
                     CASE dr.status
                       WHEN 'ACTIVE' THEN 0
                       WHEN 'READY' THEN 1
                       ELSE 2
                     END,
                     dr.created_at DESC,
                     dr.id DESC
                 ) AS row_num
          FROM discussion_runs dr
          INNER JOIN discussion_guides dg ON dg.id = dr.guide_id
          INNER JOIN active_interviews ai
            ON ai.id = dg.interview_id AND ai.row_num = 1
          WHERE dr.user_id = #{userId}
        )
        SELECT b.id AS bookId,
               b.title AS bookTitle,
               b.author AS bookAuthor,
               b.cover_image_url AS coverImageUrl,
               rs.id AS sessionId,
               pr.id AS reflectionId,
               COALESCE(rr.revision_count, 0) AS revisionCount,
               LEFT(rr.content, 280) AS reflectionPreview,
               ai.id AS interviewId,
               ai.status AS interviewStatus,
               ai.answered_count AS answeredCount,
               ai.generated_count AS generatedCount,
               LEFT(cq.question_text, 280) AS currentQuestion,
               cg.id AS guideId,
               run.id AS runId,
               run.status AS runStatus,
               run.refinement_outcome AS refinementOutcome,
               GREATEST(
                 b.updated_at,
                 COALESCE(rs.updated_at, b.updated_at),
                 COALESCE(pr.updated_at, b.updated_at),
                 COALESCE(rr.created_at, b.updated_at),
                 COALESCE(ai.updated_at, b.updated_at),
                 COALESCE(cg.updated_at, b.updated_at),
                 COALESCE(run.updated_at, b.updated_at)
               ) AS lastActivityAt
        FROM books b
        LEFT JOIN ranked_sessions rs
          ON rs.book_id = b.id AND rs.row_num = 1
        LEFT JOIN primary_reflections pr
          ON pr.session_id = rs.id AND pr.row_num = 1
        LEFT JOIN ranked_revisions rr
          ON rr.reflection_insight_id = pr.id AND rr.row_num = 1
        LEFT JOIN active_interviews ai
          ON ai.source_revision_id = rr.id AND ai.row_num = 1
        LEFT JOIN current_questions cq
          ON cq.reflection_interview_id = ai.id AND cq.row_num = 1
        LEFT JOIN current_guides cg
          ON cg.interview_id = ai.id
        LEFT JOIN prioritized_runs run
          ON run.interview_id = ai.id AND run.row_num = 1
        WHERE b.user_id = #{userId}
          AND b.deleted_at IS NULL
          AND COALESCE(b.reading_status, 'want_to_read') = 'reading'
        ORDER BY lastActivityAt DESC, b.id DESC
        """)
    List<MobileReflectionThreadRecord> findReadingThreads(Long userId);
}
