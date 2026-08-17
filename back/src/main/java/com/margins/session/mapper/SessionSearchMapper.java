package com.margins.session.mapper;

import com.margins.session.model.SessionSearchResultRecord;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 세션 통합 검색에 필요한 조회를 담당하는 MyBatis 매퍼다.
 * 세션, 책, 메시지, 기록 데이터를 검색 결과 형태로 모은다.
 */
@Mapper
public interface SessionSearchMapper {

    @Select("""
        SELECT *
        FROM (
          SELECT
            rs.id AS session_id,
            rs.id AS source_id,
            'session' AS result_type,
            b.title AS book_title,
            rs.title AS session_title,
            CONCAT(b.title, ' - ', rs.title) AS snippet,
            rs.updated_at AS sort_time
          FROM reading_sessions rs
          INNER JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
          WHERE rs.user_id = #{userId}
            AND rs.deleted_at IS NULL
            AND (
              LOWER(rs.title) LIKE CONCAT('%', LOWER(#{query}), '%')
              OR LOWER(b.title) LIKE CONCAT('%', LOWER(#{query}), '%')
              OR LOWER(COALESCE(b.author, '')) LIKE CONCAT('%', LOWER(#{query}), '%')
            )
          UNION ALL
          SELECT
            rs.id AS session_id,
            st.id AS source_id,
            'tag' AS result_type,
            b.title AS book_title,
            rs.title AS session_title,
            st.label AS snippet,
            st.created_at AS sort_time
          FROM session_tags st
          INNER JOIN reading_sessions rs ON rs.id = st.session_id AND rs.deleted_at IS NULL
          INNER JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
          WHERE st.user_id = #{userId}
            AND st.deleted_at IS NULL
            AND LOWER(st.label) LIKE CONCAT('%', LOWER(#{query}), '%')
          UNION ALL
          SELECT
            rs.id AS session_id,
            h.id AS source_id,
            'highlight' AS result_type,
            b.title AS book_title,
            rs.title AS session_title,
            LEFT(CONCAT_WS(' ', h.quote_text, h.note, h.location_label), 240) AS snippet,
            h.updated_at AS sort_time
          FROM session_highlights h
          INNER JOIN reading_sessions rs ON rs.id = h.session_id AND rs.deleted_at IS NULL
          INNER JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
          WHERE h.user_id = #{userId}
            AND h.deleted_at IS NULL
            AND LOWER(CONCAT_WS(' ', h.quote_text, h.note, h.location_label)) LIKE CONCAT('%', LOWER(#{query}), '%')
          UNION ALL
          SELECT
            rs.id AS session_id,
            si.id AS source_id,
            'insight' AS result_type,
            b.title AS book_title,
            rs.title AS session_title,
            LEFT(CONCAT_WS(' ', si.title, si.content, si.evidence), 240) AS snippet,
            si.updated_at AS sort_time
          FROM session_insights si
          INNER JOIN reading_sessions rs ON rs.id = si.session_id AND rs.deleted_at IS NULL
          INNER JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
          WHERE si.user_id = #{userId}
            AND si.deleted_at IS NULL
            AND LOWER(CONCAT_WS(' ', si.insight_type, si.title, si.content, si.evidence)) LIKE CONCAT('%', LOWER(#{query}), '%')
          UNION ALL
          SELECT
            rs.id AS session_id,
            m.id AS source_id,
            'message' AS result_type,
            b.title AS book_title,
            rs.title AS session_title,
            LEFT(m.content, 240) AS snippet,
            m.updated_at AS sort_time
          FROM messages m
          INNER JOIN reading_sessions rs ON rs.id = m.session_id AND rs.deleted_at IS NULL
          INNER JOIN books b ON b.id = rs.book_id AND b.deleted_at IS NULL
          INNER JOIN session_windows sw ON sw.id = m.window_id AND sw.deleted_at IS NULL
          WHERE m.user_id = #{userId}
            AND m.deleted_at IS NULL
            AND LOWER(m.content) LIKE CONCAT('%', LOWER(#{query}), '%')
        ) results
        ORDER BY sort_time DESC, source_id DESC
        LIMIT #{limit}
        """)
    List<SessionSearchResultRecord> search(
        @Param("userId") Long userId,
        @Param("query") String query,
        @Param("limit") int limit
    );
}
