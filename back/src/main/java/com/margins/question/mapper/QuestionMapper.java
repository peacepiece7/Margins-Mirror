package com.margins.question.mapper;

import com.margins.question.model.QuestionRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 질문 테이블에 접근하는 MyBatis 매퍼다.
 * 세션/윈도우별 질문 저장, 조회, 삭제 상태 반영 쿼리를 담당한다.
 */
@Mapper
public interface QuestionMapper {

    @Insert("""
        INSERT INTO questions (
          session_id,
          window_id,
          user_id,
          reflection_interview_id,
          question_text,
          question_type,
          coverage_area,
          response_mode,
          source_type,
          source_ref_id,
          source_excerpt,
          source_version,
          source_stale,
          source_fallback,
          sensitivity,
          status,
          ai_model,
          is_test_data
        )
        VALUES (
          #{sessionId},
          #{windowId},
          #{userId},
          #{reflectionInterviewId},
          #{questionText},
          #{questionType},
          #{coverageArea},
          #{responseMode},
          #{sourceType},
          #{sourceRefId},
          #{sourceExcerpt},
          #{sourceVersion},
          #{sourceStale},
          #{sourceFallback},
          #{sensitivity},
          #{status},
          #{aiModel},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(QuestionRecord record);

    @Select("""
        SELECT
          q.id,
          q.session_id,
          q.window_id,
          q.user_id,
          q.question_text,
          q.question_type,
          q.status,
          q.ai_model,
          q.is_test_data
        FROM questions q
        LEFT JOIN session_windows sw ON sw.id = q.window_id
        WHERE q.session_id = #{sessionId}
          AND q.deleted_at IS NULL
          AND (q.window_id IS NULL OR sw.deleted_at IS NULL)
        ORDER BY q.id ASC
        """)
    List<QuestionRecord> findBySessionId(Long sessionId);

    @Select("""
        SELECT
          q.id,
          q.session_id,
          q.window_id,
          q.user_id,
          q.question_text,
          q.question_type,
          q.status,
          q.ai_model,
          q.is_test_data
        FROM questions q
        INNER JOIN session_windows sw ON sw.id = q.window_id
        WHERE q.window_id = #{windowId}
          AND q.deleted_at IS NULL
          AND sw.deleted_at IS NULL
        ORDER BY q.id ASC
        """)
    List<QuestionRecord> findByWindowId(Long windowId);

    @Select("""
        SELECT
          q.id,
          q.session_id,
          q.window_id,
          q.user_id,
          q.question_text,
          q.question_type,
          q.status,
          q.ai_model,
          q.is_test_data
        FROM questions q
        INNER JOIN session_windows sw ON sw.id = q.window_id
        WHERE q.id = #{questionId}
          AND q.user_id = #{userId}
          AND q.deleted_at IS NULL
          AND sw.deleted_at IS NULL
        """)
    QuestionRecord findActiveById(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT (
          EXISTS (
            SELECT 1
            FROM messages
            WHERE question_id = #{questionId}
              AND role = 'user'
              AND deleted_at IS NULL
          )
          OR EXISTS (
            SELECT 1
            FROM session_insights
            WHERE question_id = #{questionId}
              AND insight_type = 'question_answer'
              AND deleted_at IS NULL
          )
        )
        """)
    int countActiveUserAnswers(Long questionId);

    @Update("""
        UPDATE questions
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = #{questionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int softDelete(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );
}
