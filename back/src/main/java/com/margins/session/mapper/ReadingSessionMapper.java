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
        SELECT rs.id, rs.title
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
