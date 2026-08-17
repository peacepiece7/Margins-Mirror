package com.margins.metric.mapper;

import com.margins.metric.model.MetricRecord;
import com.margins.metric.model.SessionMetricSourceRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 지표 계산에 필요한 집계 데이터를 조회하는 MyBatis 매퍼다.
 * 세션 활동량과 통계 원천 레코드를 SQL로 모은다.
 */
@Mapper
public interface MetricMapper {

    @Select("""
        SELECT
          rs.user_id,
          rs.book_id,
          rs.id AS session_id,

          COUNT(DISTINCT sw.id) AS window_count,
          COUNT(DISTINCT q.id) AS question_count,
          (
            SELECT COUNT(DISTINCT legacy.question_id)
            FROM messages legacy
            WHERE legacy.session_id = rs.id
              AND legacy.role = 'user'
              AND legacy.question_id IS NOT NULL
              AND legacy.deleted_at IS NULL
          ) + (
            SELECT COUNT(DISTINCT answer.question_id)
            FROM session_insights answer
            WHERE answer.session_id = rs.id
              AND answer.insight_type = 'question_answer'
              AND answer.question_id IS NOT NULL
              AND answer.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1
                FROM messages legacy
                WHERE legacy.session_id = rs.id
                  AND legacy.question_id = answer.question_id
                  AND legacy.role = 'user'
                  AND legacy.deleted_at IS NULL
              )
          ) AS answered_question_count,
          COUNT(DISTINCT h.id) AS highlight_count,
          COUNT(DISTINCT m.id) AS message_count,
          COUNT(DISTINCT m.persona_id) AS persona_count
        FROM reading_sessions rs
        INNER JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
        LEFT JOIN session_windows sw ON sw.session_id = rs.id AND sw.deleted_at IS NULL
        LEFT JOIN questions q ON q.session_id = rs.id
          AND q.deleted_at IS NULL
          AND (
            q.window_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM session_windows qsw
              WHERE qsw.id = q.window_id
                AND qsw.deleted_at IS NULL
            )
          )
        LEFT JOIN session_highlights h ON h.session_id = rs.id AND h.deleted_at IS NULL
        LEFT JOIN messages m ON m.session_id = rs.id
          AND m.deleted_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM session_windows msw
            WHERE msw.id = m.window_id
              AND msw.deleted_at IS NULL
          )
        WHERE rs.id = #{sessionId}
          AND rs.user_id = #{userId}
          AND rs.deleted_at IS NULL
        GROUP BY rs.user_id, rs.book_id, rs.id
        """)
    SessionMetricSourceRecord findSessionSource(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO metrics (
          user_id,
          book_id,
          session_id,
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
          #{userId},
          #{bookId},
          #{sessionId},
          #{metricName},
          #{metricScope},
          CURRENT_DATE,
          CURRENT_DATE,
          #{metricValue},
          #{metricUnit},
          #{metricDetails},
          #{sourceRef},
          #{generatedBy},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(MetricRecord record);
}
