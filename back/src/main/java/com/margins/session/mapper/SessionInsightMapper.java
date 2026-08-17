package com.margins.session.mapper;

import com.margins.session.model.SessionInsightRecord;
import com.margins.session.model.PublicReviewRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 세션 인사이트 테이블에 접근하는 MyBatis 매퍼다.
 * 독서 중 얻은 해석과 생각의 생성, 조회, 수정, 삭제 쿼리를 담당한다.
 */
@Mapper
public interface SessionInsightMapper {

    @Insert("""
        INSERT INTO session_insights (
          session_id,
          user_id,
          question_id,
          insight_type,
          title,
          content,
          evidence,
          author_name,
          visibility,
          reviewed_on,
          insight_order,
          is_test_data
        )
        VALUES (
          #{sessionId},
          #{userId},
          #{questionId},
          #{insightType},
          #{title},
          #{content},
          #{evidence},
          #{authorName},
          #{visibility},
          #{reviewedOn},
          #{insightOrder},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(SessionInsightRecord record);

    @Select("""
        SELECT COALESCE(MAX(insight_order), 0) + 1
        FROM session_insights
        WHERE session_id = #{sessionId}
          AND deleted_at IS NULL
        """)
    int selectNextOrder(Long sessionId);

    @Select("""
        SELECT id, session_id, user_id, question_id, insight_type, title, content, evidence, author_name, visibility, reviewed_on, insight_order, created_at, updated_at, is_test_data
        FROM session_insights
        WHERE session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        ORDER BY insight_order ASC, id ASC
        """)
    List<SessionInsightRecord> findBySessionId(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, session_id, user_id, question_id, insight_type, title, content, evidence, author_name, visibility, reviewed_on, insight_order, created_at, updated_at, is_test_data
        FROM session_insights
        WHERE question_id = #{questionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    SessionInsightRecord findActiveByQuestionId(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, session_id, user_id, question_id, insight_type, title, content, evidence, author_name, visibility, reviewed_on, insight_order, created_at, updated_at, is_test_data
        FROM session_insights
        WHERE id = #{insightId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    SessionInsightRecord findActiveById(
        @Param("sessionId") Long sessionId,
        @Param("insightId") Long insightId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT
          si.id AS insight_id,
          si.session_id,
          rs.book_id,
          b.title AS book_title,
          b.author AS book_author,
          rs.title AS session_title,
          si.title,
          si.content,
          si.evidence,
          si.author_name,
          si.reviewed_on,
          si.created_at,
          si.updated_at
        FROM session_insights si
        INNER JOIN reading_sessions rs ON rs.id = si.session_id
        INNER JOIN books b ON b.id = rs.book_id
        WHERE si.visibility = 'PUBLIC'
          AND si.insight_type = 'reflection'
          AND si.deleted_at IS NULL
          AND si.id = (
            SELECT current_reflection.id
            FROM session_insights current_reflection
            WHERE current_reflection.session_id = si.session_id
              AND current_reflection.user_id = si.user_id
              AND current_reflection.insight_type = 'reflection'
              AND current_reflection.deleted_at IS NULL
            ORDER BY current_reflection.updated_at DESC, current_reflection.id DESC
            LIMIT 1
          )
          AND rs.deleted_at IS NULL
          AND b.deleted_at IS NULL
        ORDER BY COALESCE(si.reviewed_on, DATE(si.created_at)) DESC, si.id DESC
        LIMIT #{limit}
        """)
    List<PublicReviewRecord> findPublicReviews(@Param("limit") int limit);

    @Update("""
        UPDATE session_insights
        SET insight_type = #{insightType},
            title = #{title},
            content = #{content},
            summary = NULL,
            summary_source_hash = NULL,
            summary_model = NULL,
            summary_token_usage = NULL,
            summarized_at = NULL,
            summary_status = CASE WHEN #{insightType} = 'reflection' THEN 'pending' ELSE NULL END,
            evidence = #{evidence},
            author_name = #{authorName},
            visibility = #{visibility},
            reviewed_on = #{reviewedOn}
        WHERE id = #{insightId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int update(
        @Param("sessionId") Long sessionId,
        @Param("insightId") Long insightId,
        @Param("userId") Long userId,
        @Param("insightType") String insightType,
        @Param("title") String title,
        @Param("content") String content,
        @Param("evidence") String evidence,
        @Param("authorName") String authorName,
        @Param("visibility") String visibility,
        @Param("reviewedOn") java.time.LocalDate reviewedOn
    );

    @Update("""
        UPDATE session_insights
        SET content = #{content},
            updated_at = CURRENT_TIMESTAMP
        WHERE question_id = #{questionId}
          AND user_id = #{userId}
          AND insight_type = 'question_answer'
          AND deleted_at IS NULL
        """)
    int updateQuestionAnswer(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId,
        @Param("content") String content
    );

    @Update("""
        UPDATE session_insights
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = #{insightId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int softDelete(
        @Param("sessionId") Long sessionId,
        @Param("insightId") Long insightId,
        @Param("userId") Long userId
    );
}
