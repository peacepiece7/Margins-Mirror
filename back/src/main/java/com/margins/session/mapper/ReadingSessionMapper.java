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

    /**
     * Locks the active owned book row so every session ensure for the same book is serialized.
     * A nullable Boolean is intentional: false is a valid production-data marker while null
     * means the book is missing or inaccessible.
     */
    @Select("""
        SELECT is_test_data FROM books
        WHERE id = #{bookId} AND user_id = #{userId} AND deleted_at IS NULL
        FOR UPDATE
        """)
    Boolean lockActiveBookTestData(
        @Param("bookId") Long bookId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT rs.id, rs.title
        FROM books b
        INNER JOIN reading_sessions rs
          ON rs.id = b.current_reading_session_id
         AND rs.book_id = b.id
         AND rs.user_id = b.user_id
         AND rs.deleted_at IS NULL
        WHERE b.id = #{bookId}
          AND b.user_id = #{userId}
          AND b.deleted_at IS NULL
        """)
    ReadingSessionRecord findCurrentByBookIdAndUserId(
        @Param("bookId") Long bookId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT rs.id, rs.title
        FROM reading_sessions rs
        INNER JOIN books b ON b.id = rs.book_id
        WHERE rs.book_id = #{bookId} AND rs.user_id = #{userId}
          AND rs.deleted_at IS NULL AND b.deleted_at IS NULL
        ORDER BY rs.created_at DESC, rs.id DESC
        LIMIT 1
        """)
    ReadingSessionRecord findLatestCreatedByBookIdAndUserId(
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
        ORDER BY rs.created_at DESC, rs.id DESC
        LIMIT 1
        """)
    ReadingSessionRecord findLatestByUserId(Long userId);

    @Update("""
        UPDATE books b
        SET b.current_reading_session_id = #{sessionId,jdbcType=BIGINT}
        WHERE b.id = #{bookId}
          AND b.user_id = #{userId}
          AND b.deleted_at IS NULL
          AND (
            #{sessionId,jdbcType=BIGINT} IS NULL
            OR EXISTS (
              SELECT 1
              FROM reading_sessions rs
              WHERE rs.id = #{sessionId,jdbcType=BIGINT}
                AND rs.book_id = b.id
                AND rs.user_id = b.user_id
                AND rs.deleted_at IS NULL
            )
          )
        """)
    int updateCurrentForBook(
        @Param("bookId") Long bookId,
        @Param("userId") Long userId,
        @Param("sessionId") Long sessionId
    );

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

    /** Locks the active session and its owned active book before archive changes current identity. */
    @Select("""
        SELECT rs.id, rs.user_id, rs.book_id, b.title AS book_title,
               b.author AS book_author, rs.title, rs.is_test_data
        FROM reading_sessions rs
        INNER JOIN books b
          ON b.id = rs.book_id
         AND b.user_id = rs.user_id
         AND b.deleted_at IS NULL
        WHERE rs.id = #{sessionId}
          AND rs.user_id = #{userId}
          AND rs.deleted_at IS NULL
        FOR UPDATE
        """)
    ReadingSessionRecord lockByIdAndUserId(
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
