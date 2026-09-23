package com.margins.book.mapper;

import com.margins.book.model.LibraryActivityRecord;
import com.margins.book.model.LibraryCountRecord;
import com.margins.book.model.LibraryRevisionSummaryRecord;
import com.margins.book.model.LibraryThreadRecord;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Library thread page와 bounded count/activity projection을 조회하는 MyBatis 매퍼다. */
@Mapper
public interface LibraryThreadMapper {

    @Select("""
        <script>
        SELECT
          b.id AS bookId,
          b.user_id AS userId,
          b.title,
          b.subtitle,
          b.author,
          b.publisher,
          b.isbn,
          b.published_year AS publishedYear,
          b.language_code AS languageCode,
          b.source,
          b.source_ref AS sourceRef,
          b.cover_image_url AS coverImageUrl,
          b.reading_status AS readingStatus,
          b.rating,
          b.status_started_at AS statusStartedAt,
          b.status_finished_at AS statusFinishedAt,
          b.updated_at AS bookUpdatedAt,
          rs.id AS sessionId,
          si.id AS reflectionId,
          rr.id AS currentRevisionId,
          rr.version AS currentRevisionNumber,
          rr.created_at AS currentRevisionAt,
          ri.id AS interviewId,
          ri.answered_count AS answeredCount,
          ri.status AS interviewStatus,
          dg.id AS guideId,
          dg.status AS guideStatus,
          dr.id AS runId,
          dr.status AS runStatus,
          dr.refined_revision_id AS refinedRevisionId,
          dr.updated_at AS runUpdatedAt
        FROM books b
        LEFT JOIN reading_sessions rs
          ON rs.id = COALESCE(
            (
              SELECT current_session.id
              FROM reading_sessions current_session
              WHERE current_session.id = b.current_reading_session_id
                AND current_session.book_id = b.id
                AND current_session.user_id = #{userId}
                AND current_session.deleted_at IS NULL
            ),
            (
              SELECT candidate_session.id
              FROM reading_sessions candidate_session
              WHERE candidate_session.book_id = b.id
                AND candidate_session.user_id = #{userId}
                AND candidate_session.deleted_at IS NULL
              ORDER BY candidate_session.created_at DESC, candidate_session.id DESC
              LIMIT 1
            )
          )
         AND rs.book_id = b.id
         AND rs.user_id = #{userId}
         AND rs.deleted_at IS NULL
        LEFT JOIN session_insights si ON si.id = (
          SELECT candidate_reflection.id
          FROM session_insights candidate_reflection
          WHERE candidate_reflection.session_id = rs.id
            AND candidate_reflection.user_id = #{userId}
            AND candidate_reflection.insight_type = 'reflection'
            AND candidate_reflection.deleted_at IS NULL
          ORDER BY candidate_reflection.updated_at DESC, candidate_reflection.id DESC
          LIMIT 1
        )
        LEFT JOIN reflection_revisions rr ON rr.id = (
          SELECT candidate_revision.id
          FROM reflection_revisions candidate_revision
          WHERE candidate_revision.reflection_insight_id = si.id
            AND candidate_revision.user_id = #{userId}
          ORDER BY candidate_revision.version DESC, candidate_revision.id DESC
          LIMIT 1
        )
        LEFT JOIN reflection_interviews ri ON ri.id = (
          SELECT candidate_interview.id
          FROM reflection_interviews candidate_interview
          WHERE candidate_interview.source_revision_id = rr.id
            AND candidate_interview.user_id = #{userId}
          ORDER BY
            CASE candidate_interview.status
              WHEN 'ACTIVE' THEN 0
              WHEN 'GUIDE_READY' THEN 1
              WHEN 'COMPLETED' THEN 2
              ELSE 3
            END,
            candidate_interview.updated_at DESC,
            candidate_interview.id DESC
          LIMIT 1
        )
        LEFT JOIN discussion_guides dg ON dg.id = (
          SELECT candidate_guide.id
          FROM discussion_guides candidate_guide
          WHERE candidate_guide.interview_id = ri.id
            AND candidate_guide.user_id = #{userId}
            AND candidate_guide.is_current = TRUE
          ORDER BY candidate_guide.guide_version DESC, candidate_guide.id DESC
          LIMIT 1
        )
        LEFT JOIN discussion_runs dr ON dr.guide_id = dg.id AND dr.user_id = #{userId}
        WHERE b.user_id = #{userId}
          AND b.deleted_at IS NULL
          <if test="statusFilter != null">
            AND COALESCE(b.reading_status, 'want_to_read') = #{statusFilter}
          </if>
        <choose>
          <when test="stageFilter == 'REFLECT'">
            AND (si.id IS NULL OR rr.id IS NULL)
          </when>
          <when test="stageFilter == 'INTERVIEW'">
            AND si.id IS NOT NULL AND rr.id IS NOT NULL
            AND (ri.id IS NULL OR dg.id IS NULL)
          </when>
          <when test="stageFilter == 'GUIDE'">
            AND ri.id IS NOT NULL AND dg.id IS NOT NULL AND dr.id IS NULL
          </when>
          <when test="stageFilter == 'DISCUSS'">
            AND dr.id IS NOT NULL AND (dr.status IS NULL OR dr.status != 'COMPLETED')
          </when>
          <when test="stageFilter == 'REFINE'">
            AND dr.id IS NOT NULL AND dr.status = 'COMPLETED'
          </when>
        </choose>
        <choose>
          <when test="sort == 'title_asc'">
            ORDER BY LOWER(b.title) COLLATE utf8mb4_bin ASC, b.id DESC
          </when>
          <when test="sort == 'title_desc'">
            ORDER BY LOWER(b.title) COLLATE utf8mb4_bin DESC, b.id DESC
          </when>
          <when test="sort == 'rating_desc'">
            ORDER BY b.rating IS NULL ASC, b.rating DESC,
                     b.updated_at IS NULL ASC, b.updated_at DESC, b.id DESC
          </when>
          <when test="sort == 'rating_asc'">
            ORDER BY b.rating IS NULL ASC, b.rating ASC,
                     b.updated_at IS NULL ASC, b.updated_at DESC, b.id DESC
          </when>
          <when test="sort == 'status'">
            ORDER BY CASE COALESCE(b.reading_status, 'want_to_read')
                       WHEN 'reading' THEN 0
                       WHEN 'want_to_read' THEN 1
                       WHEN 'read' THEN 2
                       WHEN 'dnf' THEN 3
                       ELSE 4
                     END ASC,
                     b.updated_at IS NULL ASC, b.updated_at DESC, b.id DESC
          </when>
          <otherwise>
            ORDER BY b.updated_at IS NULL ASC, b.updated_at DESC, b.id DESC
          </otherwise>
        </choose>
        LIMIT #{rowLimit} OFFSET #{offset}
        </script>
        """)
    List<LibraryThreadRecord> findThreads(
        @Param("userId") Long userId,
        @Param("statusFilter") String statusFilter,
        @Param("stageFilter") String stageFilter,
        @Param("sort") String sort,
        @Param("rowLimit") int rowLimit,
        @Param("offset") int offset
    );

    @Select("""
        SELECT COALESCE(reading_status, 'want_to_read') AS category, COUNT(*) AS total
        FROM books
        WHERE user_id = #{userId}
          AND deleted_at IS NULL
        GROUP BY COALESCE(reading_status, 'want_to_read')
        """)
    List<LibraryCountRecord> countByShelf(@Param("userId") Long userId);

    @Select("""
        SELECT staged.category, COUNT(*) AS total
        FROM (
          SELECT CASE
            WHEN si.id IS NULL OR rr.id IS NULL THEN 'REFLECT'
            WHEN ri.id IS NULL OR dg.id IS NULL THEN 'INTERVIEW'
            WHEN dr.id IS NULL THEN 'GUIDE'
            WHEN dr.status = 'COMPLETED' THEN 'REFINE'
            ELSE 'DISCUSS'
          END AS category
          FROM books b
          LEFT JOIN reading_sessions rs
            ON rs.id = COALESCE(
              (
                SELECT current_session.id
                FROM reading_sessions current_session
                WHERE current_session.id = b.current_reading_session_id
                  AND current_session.book_id = b.id
                  AND current_session.user_id = #{userId}
                  AND current_session.deleted_at IS NULL
              ),
              (
                SELECT candidate_session.id
                FROM reading_sessions candidate_session
                WHERE candidate_session.book_id = b.id
                  AND candidate_session.user_id = #{userId}
                  AND candidate_session.deleted_at IS NULL
                ORDER BY candidate_session.created_at DESC, candidate_session.id DESC
                LIMIT 1
              )
            )
           AND rs.book_id = b.id
           AND rs.user_id = #{userId}
           AND rs.deleted_at IS NULL
          LEFT JOIN session_insights si ON si.id = (
            SELECT candidate_reflection.id
            FROM session_insights candidate_reflection
            WHERE candidate_reflection.session_id = rs.id
              AND candidate_reflection.user_id = #{userId}
              AND candidate_reflection.insight_type = 'reflection'
              AND candidate_reflection.deleted_at IS NULL
            ORDER BY candidate_reflection.updated_at DESC, candidate_reflection.id DESC
            LIMIT 1
          )
          LEFT JOIN reflection_revisions rr ON rr.id = (
            SELECT candidate_revision.id
            FROM reflection_revisions candidate_revision
            WHERE candidate_revision.reflection_insight_id = si.id
              AND candidate_revision.user_id = #{userId}
            ORDER BY candidate_revision.version DESC, candidate_revision.id DESC
            LIMIT 1
          )
          LEFT JOIN reflection_interviews ri ON ri.id = (
            SELECT candidate_interview.id
            FROM reflection_interviews candidate_interview
            WHERE candidate_interview.source_revision_id = rr.id
              AND candidate_interview.user_id = #{userId}
            ORDER BY
              CASE candidate_interview.status
                WHEN 'ACTIVE' THEN 0
                WHEN 'GUIDE_READY' THEN 1
                WHEN 'COMPLETED' THEN 2
                ELSE 3
              END,
              candidate_interview.updated_at DESC,
              candidate_interview.id DESC
            LIMIT 1
          )
          LEFT JOIN discussion_guides dg ON dg.id = (
            SELECT candidate_guide.id
            FROM discussion_guides candidate_guide
            WHERE candidate_guide.interview_id = ri.id
              AND candidate_guide.user_id = #{userId}
              AND candidate_guide.is_current = TRUE
            ORDER BY candidate_guide.guide_version DESC, candidate_guide.id DESC
            LIMIT 1
          )
          LEFT JOIN discussion_runs dr ON dr.guide_id = dg.id AND dr.user_id = #{userId}
          WHERE b.user_id = #{userId}
            AND b.deleted_at IS NULL
        ) staged
        GROUP BY staged.category
        """)
    List<LibraryCountRecord> countByStage(@Param("userId") Long userId);

    @Select("""
        SELECT
          rs.book_id AS bookId,
          b.title AS bookTitle,
          b.author AS bookAuthor,
          rr.id AS revisionId,
          rr.version,
          rr.revision_source AS revisionSource,
          rr.created_at AS createdAt
        FROM reflection_revisions rr
        INNER JOIN session_insights si
          ON si.id = rr.reflection_insight_id
         AND si.user_id = #{userId}
         AND si.insight_type = 'reflection'
         AND si.deleted_at IS NULL
        INNER JOIN reading_sessions rs
          ON rs.id = rr.session_id
         AND rs.user_id = #{userId}
         AND rs.deleted_at IS NULL
        INNER JOIN books b
          ON b.id = rs.book_id
         AND b.user_id = #{userId}
         AND b.deleted_at IS NULL
        WHERE rr.user_id = #{userId}
        ORDER BY rr.created_at DESC, rr.id DESC
        LIMIT #{limit}
        """)
    List<LibraryActivityRecord> findRecentActivity(
        @Param("userId") Long userId,
        @Param("limit") int limit
    );

    @Select("""
        <script>
        SELECT ranked.bookId, ranked.revisionId, ranked.version,
               ranked.revisionSource, ranked.createdAt
        FROM (
          SELECT rs.book_id AS bookId,
                 rr.id AS revisionId,
                 rr.version,
                 rr.revision_source AS revisionSource,
                 rr.created_at AS createdAt,
                 ROW_NUMBER() OVER (
                   PARTITION BY rs.book_id
                   ORDER BY rr.created_at DESC, rr.id DESC
                 ) AS rowNumber
          FROM reflection_revisions rr
          INNER JOIN session_insights si
            ON si.id = rr.reflection_insight_id
           AND si.user_id = #{userId}
           AND si.insight_type = 'reflection'
           AND si.deleted_at IS NULL
          INNER JOIN reading_sessions rs
            ON rs.id = rr.session_id
           AND rs.user_id = #{userId}
           AND rs.deleted_at IS NULL
          WHERE rr.user_id = #{userId}
            AND rs.book_id IN
            <foreach collection="bookIds" item="bookId" open="(" separator="," close=")">
              #{bookId}
            </foreach>
        ) ranked
        WHERE ranked.rowNumber &lt;= 3
        ORDER BY ranked.bookId, ranked.createdAt DESC, ranked.revisionId DESC
        </script>
        """)
    List<LibraryRevisionSummaryRecord> findRecentRevisions(
        @Param("userId") Long userId,
        @Param("bookIds") List<Long> bookIds
    );
}
