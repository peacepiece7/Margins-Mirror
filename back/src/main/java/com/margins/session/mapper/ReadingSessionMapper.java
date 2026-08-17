package com.margins.session.mapper;

import com.margins.session.model.ReadingSessionRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/** Maps saved books to their conversation sessions and loads session artifacts. */
@Mapper
public interface ReadingSessionMapper {

    @Select("""
        SELECT COUNT(*) FROM books
        WHERE id = #{bookId} AND user_id = #{userId} AND deleted_at IS NULL
        """)
    int countActiveBookById(@Param("bookId") Long bookId, @Param("userId") Long userId);

    @Select("""
        SELECT is_test_data FROM books
        WHERE id = #{bookId} AND user_id = #{userId} AND deleted_at IS NULL
        """)
    boolean findBookTestData(@Param("bookId") Long bookId, @Param("userId") Long userId);

    @Select("""
        SELECT rs.id, rs.user_id, rs.book_id, b.title AS book_title,
               b.author AS book_author, rs.title, rs.is_test_data
        FROM reading_sessions rs
        INNER JOIN books b ON b.id = rs.book_id
        WHERE rs.book_id = #{bookId} AND rs.user_id = #{userId}
          AND rs.deleted_at IS NULL AND b.deleted_at IS NULL
        ORDER BY rs.updated_at DESC, rs.id DESC
        LIMIT 1
        """)
    ReadingSessionRecord findFirstByBookIdAndUserId(
        @Param("bookId") Long bookId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO reading_sessions (user_id, book_id, title, is_test_data)
        VALUES (#{userId}, #{bookId}, #{title}, #{testData})
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ReadingSessionRecord record);

    @Select("""
        SELECT rs.id, rs.user_id, rs.book_id, b.title AS book_title,
               b.author AS book_author, rs.title, rs.is_test_data
        FROM reading_sessions rs
        INNER JOIN books b ON b.id = rs.book_id
        WHERE rs.user_id = #{userId} AND rs.deleted_at IS NULL AND b.deleted_at IS NULL
        ORDER BY rs.updated_at DESC, rs.id DESC
        LIMIT 1
        """)
    ReadingSessionRecord findLatestByUserId(Long userId);

    @Select("""
        SELECT rs.id, rs.user_id, rs.book_id, b.title AS book_title,
               b.author AS book_author, rs.title,
               COUNT(DISTINCT sw.id) AS window_count,
               COUNT(DISTINCT q.id) AS question_count,
               (
                 SELECT COUNT(DISTINCT legacy.question_id) FROM messages legacy
                 WHERE legacy.session_id = rs.id AND legacy.role = 'user'
                   AND legacy.question_id IS NOT NULL AND legacy.deleted_at IS NULL
               ) + (
                 SELECT COUNT(DISTINCT answer.question_id) FROM session_insights answer
                 WHERE answer.session_id = rs.id AND answer.insight_type = 'question_answer'
                   AND answer.question_id IS NOT NULL AND answer.deleted_at IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM messages legacy
                     WHERE legacy.session_id = rs.id AND legacy.question_id = answer.question_id
                       AND legacy.role = 'user' AND legacy.deleted_at IS NULL
                   )
               ) AS answered_question_count,
               COUNT(DISTINCT h.id) AS highlight_count,
               COUNT(DISTINCT m.id) AS message_count,
               rs.is_test_data
        FROM reading_sessions rs
        INNER JOIN books b ON b.id = rs.book_id
        LEFT JOIN session_windows sw ON sw.session_id = rs.id AND sw.deleted_at IS NULL
        LEFT JOIN questions q ON q.session_id = rs.id AND q.deleted_at IS NULL
          AND (q.window_id IS NULL OR EXISTS (
            SELECT 1 FROM session_windows qsw
            WHERE qsw.id = q.window_id AND qsw.deleted_at IS NULL
          ))
        LEFT JOIN messages qm ON qm.session_id = rs.id AND qm.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM session_windows qmw
            WHERE qmw.id = qm.window_id AND qmw.deleted_at IS NULL
          )
        LEFT JOIN session_highlights h ON h.session_id = rs.id AND h.deleted_at IS NULL
        LEFT JOIN messages m ON m.session_id = rs.id AND m.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM session_windows msw
            WHERE msw.id = m.window_id AND msw.deleted_at IS NULL
          )
        WHERE rs.user_id = #{userId} AND rs.deleted_at IS NULL AND b.deleted_at IS NULL
        GROUP BY rs.id, rs.user_id, rs.book_id, b.title, b.author, rs.title,
                 rs.is_test_data, rs.updated_at
        ORDER BY rs.updated_at DESC, rs.id DESC
        """)
    List<ReadingSessionRecord> findSummariesByUserId(Long userId);

    @Select("""
        SELECT rs.id, rs.user_id, rs.book_id, b.title AS book_title,
               b.author AS book_author, rs.title, rs.is_test_data
        FROM reading_sessions rs
        INNER JOIN books b ON b.id = rs.book_id
        WHERE rs.id = #{sessionId} AND rs.user_id = #{userId}
          AND rs.deleted_at IS NULL AND b.deleted_at IS NULL
        """)
    ReadingSessionRecord findByIdAndUserId(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE reading_sessions SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = #{sessionId} AND user_id = #{userId} AND deleted_at IS NULL
        """)
    int softDelete(@Param("sessionId") Long sessionId, @Param("userId") Long userId);

    @Update("""
        UPDATE reading_sessions SET title = #{title}
        WHERE id = #{sessionId} AND user_id = #{userId} AND deleted_at IS NULL
        """)
    int updateTitle(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId,
        @Param("title") String title
    );
}
