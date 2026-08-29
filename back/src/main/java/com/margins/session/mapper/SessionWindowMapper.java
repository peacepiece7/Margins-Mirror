package com.margins.session.mapper;

import com.margins.session.model.SessionWindowContext;
import com.margins.session.model.SessionWindowRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 세션 윈도우 테이블에 접근하는 MyBatis 매퍼다.
 * 윈도우 생성, 조회, 제목 수정, 소프트 삭제 관련 쿼리를 담당한다.
 */
@Mapper
public interface SessionWindowMapper {

    @Insert("""
        INSERT INTO session_windows (
          session_id,
          user_id,
          source_question_id,
          window_type,
          title,
          position,
          status,
          is_test_data
        )
        VALUES (
          #{sessionId},
          #{userId},
          #{sourceQuestionId},
          #{windowType},
          #{title},
          #{position},
          #{status},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(SessionWindowRecord record);

    @Select("""
        SELECT
          id,
          session_id,
          user_id,
          source_question_id,
          window_type,
          title,
          position,
          status,
          is_test_data
        FROM session_windows
        WHERE id = #{id}
          AND deleted_at IS NULL
        """)
    SessionWindowRecord findById(Long id);

    @Select("""
        SELECT
          sw.id AS id,
          sw.session_id AS sessionId,
          sw.user_id AS userId,
          b.id AS bookId,
          b.title AS bookTitle,
          b.author AS bookAuthor,
          b.isbn AS bookIsbn,
          b.raw_metadata AS bookRawMetadata
          , b.reading_status AS bookReadingStatus
          , b.rating AS bookRating
          , sw.context_snapshot AS windowContextSnapshot
          , sw.source_question_id AS sourceQuestionId
          , source_question.question_text AS sourceQuestionText
          , source_answer.content AS sourceQuestionAnswer
          , reflection.id AS reflectionInsightId
          , reflection.content AS reflectionContent
          , sw.is_test_data AS testData
        FROM session_windows sw
        INNER JOIN reading_sessions rs ON rs.id = sw.session_id
        INNER JOIN books b ON b.id = rs.book_id
        LEFT JOIN session_insights reflection ON reflection.id = (
          SELECT si.id
          FROM session_insights si
          WHERE si.session_id = rs.id
            AND si.user_id = sw.user_id
            AND si.insight_type = 'reflection'
            AND si.deleted_at IS NULL
          ORDER BY si.updated_at DESC, si.id DESC
          LIMIT 1
        )
        LEFT JOIN questions source_question
          ON source_question.id = sw.source_question_id
          AND source_question.deleted_at IS NULL
        LEFT JOIN session_insights source_answer
          ON source_answer.question_id = source_question.id
          AND source_answer.insight_type = 'question_answer'
          AND source_answer.deleted_at IS NULL
        WHERE sw.id = #{id}
          AND sw.deleted_at IS NULL
          AND rs.deleted_at IS NULL
        """)
    SessionWindowContext findContextById(Long id);

    @Select("""
        SELECT
          id,
          session_id,
          user_id,
          source_question_id,
          window_type,
          title,
          position,
          status,
          is_test_data
        FROM session_windows
        WHERE source_question_id = #{questionId}
          AND user_id = #{userId}
          AND window_type = 'debate'
          AND deleted_at IS NULL
        LIMIT 1
        """)
    SessionWindowRecord findActiveDebateBySourceQuestion(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE session_windows
        SET context_snapshot = CAST(#{contextSnapshot} AS JSON),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{windowId}
          AND deleted_at IS NULL
        """)
    int updateContextSnapshot(
        @Param("windowId") Long windowId,
        @Param("contextSnapshot") String contextSnapshot
    );

    @Update("""
        UPDATE session_windows
        SET context_snapshot = JSON_SET(
          COALESCE(context_snapshot, JSON_OBJECT()),
          '$.conversationSummaries',
          JSON_SET(
            CASE
              WHEN JSON_TYPE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries')) = 'OBJECT'
                THEN JSON_EXTRACT(context_snapshot, '$.conversationSummaries')
              ELSE JSON_OBJECT()
            END,
            '$.ko',
            CAST(#{summaryJson} AS JSON)
          )
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = #{windowId}
          AND deleted_at IS NULL
        """)
    int updateConversationSummaryKo(
        @Param("windowId") Long windowId,
        @Param("summaryJson") String summaryJson
    );

    @Update("""
        UPDATE session_windows
        SET context_snapshot = JSON_SET(
          COALESCE(context_snapshot, JSON_OBJECT()),
          '$.conversationSummaries',
          JSON_SET(
            CASE
              WHEN JSON_TYPE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries')) = 'OBJECT'
                THEN JSON_EXTRACT(context_snapshot, '$.conversationSummaries')
              ELSE JSON_OBJECT()
            END,
            '$.en',
            CAST(#{summaryJson} AS JSON)
          )
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = #{windowId}
          AND deleted_at IS NULL
        """)
    int updateConversationSummaryEn(
        @Param("windowId") Long windowId,
        @Param("summaryJson") String summaryJson
    );


    @Update("""
        UPDATE session_windows
        SET title = #{title}
        WHERE id = #{windowId}
          AND deleted_at IS NULL
        """)
    int updateTitle(
        @Param("windowId") Long windowId,
        @Param("title") String title
    );

    @Update("""
        UPDATE session_windows
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = #{windowId}
          AND deleted_at IS NULL
        """)
    int softDelete(Long windowId);

    @Select("""
        SELECT COUNT(*)
        FROM session_windows
        WHERE session_id = #{sessionId}
          AND deleted_at IS NULL
        """)
    int countActiveBySessionId(Long sessionId);

    @Select("""
        SELECT COUNT(*)
        FROM reading_sessions
        WHERE id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int countActiveSessionById(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT COALESCE(MAX(position), 0) + 1
        FROM session_windows
        WHERE session_id = #{sessionId}
          AND deleted_at IS NULL
        """)
    int selectNextPosition(Long sessionId);

    @Select("""
        SELECT
          id,
          session_id,
          user_id,
          source_question_id,
          window_type,
          title,
          position,
          status,
          is_test_data
        FROM session_windows
        WHERE session_id = #{sessionId}
          AND deleted_at IS NULL
        ORDER BY position ASC, id ASC
        """)
    List<SessionWindowRecord> findBySessionId(Long sessionId);
}
