package com.margins.session.mapper;

import com.margins.session.model.SessionHighlightRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 세션 하이라이트 테이블에 접근하는 MyBatis 매퍼다.
 * 독서 중 기록한 인용/메모의 생성, 조회, 수정, 삭제 쿼리를 담당한다.
 */
@Mapper
public interface SessionHighlightMapper {

    @Insert("""
        INSERT INTO session_highlights (
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
          #{sessionId},
          #{bookId},
          #{userId},
          #{pageNumber},
          #{locationLabel},
          #{quoteText},
          #{note},
          #{highlightOrder},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(SessionHighlightRecord record);

    @Select("""
        SELECT COALESCE(MAX(highlight_order), 0) + 1
        FROM session_highlights
        WHERE session_id = #{sessionId}
          AND deleted_at IS NULL
        """)
    int selectNextOrder(Long sessionId);

    @Select("""
        SELECT
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
        FROM session_highlights
        WHERE session_id = #{sessionId}
          AND deleted_at IS NULL
        ORDER BY highlight_order ASC, id ASC
        """)
    List<SessionHighlightRecord> findBySessionId(Long sessionId);

    @Select("""
        SELECT
          h.id,
          h.session_id,
          h.book_id,
          h.user_id,
          h.page_number,
          h.location_label,
          h.quote_text,
          h.note,
          h.highlight_order,
          h.is_test_data
        FROM session_highlights h
        INNER JOIN reading_sessions rs
          ON rs.id = h.session_id
         AND rs.user_id = #{userId}
         AND rs.deleted_at IS NULL
        WHERE h.session_id = #{sessionId}
          AND h.user_id = #{userId}
          AND h.deleted_at IS NULL
        ORDER BY h.highlight_order ASC, h.id ASC
        LIMIT #{limit}
        """)
    List<SessionHighlightRecord> findBoundedOwnedBySession(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId,
        @Param("limit") int limit
    );

    @Update("""
        UPDATE session_highlights
        SET
          page_number = #{pageNumber},
          location_label = #{locationLabel},
          quote_text = #{quoteText},
          note = #{note}
        WHERE id = #{highlightId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int update(Long sessionId, Long highlightId, Long userId, Integer pageNumber, String locationLabel, String quoteText, String note);

    @Update("""
        UPDATE session_highlights
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = #{highlightId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int softDelete(Long sessionId, Long highlightId, Long userId);
}
