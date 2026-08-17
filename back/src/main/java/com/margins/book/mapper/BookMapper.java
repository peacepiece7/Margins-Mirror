package com.margins.book.mapper;

import com.margins.book.model.BookRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 책과 서재 테이블에 접근하는 MyBatis 매퍼다.
 * 저장된 책 조회, 삽입, 수정, 소프트 삭제 쿼리를 담당한다.
 */
@Mapper
public interface BookMapper {

    String BOOK_SELECT_COLUMNS = """
        id,
        user_id,
        title,
        subtitle,
        author,
        publisher,
        isbn,
        published_year,
        language_code AS languageCode,
        description,
        source,
        source_ref AS sourceRef,
        cover_image_url AS coverImageUrl,
        raw_metadata AS rawMetadata,
        reading_status AS readingStatus,
        rating,
        status_started_at AS statusStartedAt,
        status_finished_at AS statusFinishedAt,
        updated_at AS updatedAt,
        is_test_data AS testData
        """;

    @Insert("""
        INSERT INTO books (
          user_id,
          title,
          subtitle,
          author,
          publisher,
          isbn,
          published_year,
          language_code,
          description,
          source,
          source_ref,
          cover_image_url,
          raw_metadata,
          reading_status,
          is_test_data
        )
        VALUES (
          #{userId},
          #{title},
          #{subtitle},
          #{author},
          #{publisher},
          #{isbn},
          #{publishedYear},
          #{languageCode},
          #{description},
          #{source},
          #{sourceRef},
          #{coverImageUrl},
          #{rawMetadata},
          COALESCE(#{readingStatus}, 'want_to_read'),
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(BookRecord record);

    @Select("""
        SELECT
        """ + BOOK_SELECT_COLUMNS + """
        FROM books
        WHERE user_id = #{userId}
          AND deleted_at IS NULL
          AND isbn = #{isbn}
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
        """)
    BookRecord findDuplicateByIsbn(
        @Param("userId") Long userId,
        @Param("isbn") String isbn
    );

    @Select("""
        <script>
        SELECT
        """ + BOOK_SELECT_COLUMNS + """
        FROM books
        WHERE user_id = #{userId}
          AND deleted_at IS NULL
          <if test="statusFilter != null">
            AND COALESCE(reading_status, 'want_to_read') = #{statusFilter}
          </if>
        <choose>
          <when test="sort == 'title_asc'">
            ORDER BY LOWER(title) COLLATE utf8mb4_bin ASC, id DESC
          </when>
          <when test="sort == 'title_desc'">
            ORDER BY LOWER(title) COLLATE utf8mb4_bin DESC, id DESC
          </when>
          <when test="sort == 'rating_desc'">
            ORDER BY rating IS NULL ASC, rating DESC,
                     updated_at IS NULL ASC, updated_at DESC, id DESC
          </when>
          <when test="sort == 'rating_asc'">
            ORDER BY rating IS NULL ASC, rating ASC,
                     updated_at IS NULL ASC, updated_at DESC, id DESC
          </when>
          <when test="sort == 'status'">
            ORDER BY CASE COALESCE(reading_status, 'want_to_read')
                       WHEN 'reading' THEN 0
                       WHEN 'want_to_read' THEN 1
                       WHEN 'read' THEN 2
                       WHEN 'dnf' THEN 3
                       ELSE 4
                     END ASC,
                     updated_at IS NULL ASC, updated_at DESC, id DESC
          </when>
          <otherwise>
            ORDER BY updated_at IS NULL ASC, updated_at DESC, id DESC
          </otherwise>
        </choose>
        </script>
        """)
    List<BookRecord> findByUserId(
        @Param("userId") Long userId,
        @Param("statusFilter") String statusFilter,
        @Param("sort") String sort
    );

    @Select("""
        SELECT
        """ + BOOK_SELECT_COLUMNS + """
        FROM books
        WHERE id = #{bookId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    BookRecord findByIdForUser(@Param("bookId") Long bookId, @Param("userId") Long userId);

    @Update("""
        UPDATE books
        SET
          title = #{title},
          author = #{author},
          published_year = #{publishedYear},
          raw_metadata = #{rawMetadata},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int update(BookRecord record);

    @Update("""
        UPDATE books
        SET
          reading_status = #{readingStatus},
          rating = #{rating},
          status_started_at = #{statusStartedAt},
          status_finished_at = #{statusFinishedAt},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int updateShelf(BookRecord record);

    @Update("""
        UPDATE books
        SET
          subtitle = CASE WHEN (subtitle IS NULL OR TRIM(subtitle) = '') THEN #{subtitle} ELSE subtitle END,
          publisher = CASE WHEN (publisher IS NULL OR TRIM(publisher) = '') THEN #{publisher} ELSE publisher END,
          isbn = CASE WHEN (isbn IS NULL OR TRIM(isbn) = '') THEN #{isbn} ELSE isbn END,
          published_year = COALESCE(published_year, #{publishedYear}),
          language_code = CASE WHEN (language_code IS NULL OR TRIM(language_code) = '') THEN #{languageCode} ELSE language_code END,
          description = CASE WHEN (description IS NULL OR TRIM(description) = '') THEN #{description} ELSE description END,
          source = CASE
            WHEN (source IS NULL OR TRIM(source) = '' OR source = 'ai') AND #{source} <> 'ai' THEN #{source}
            ELSE source
          END,
          source_ref = CASE
            WHEN #{source} <> 'ai'
              AND (source IS NULL OR TRIM(source) = '' OR source = 'ai' OR source_ref IS NULL OR TRIM(source_ref) = '' OR source_ref LIKE 'manual-%')
              THEN #{sourceRef}
            WHEN (source_ref IS NULL OR TRIM(source_ref) = '') THEN #{sourceRef}
            ELSE source_ref
          END,
          cover_image_url = CASE WHEN (cover_image_url IS NULL OR TRIM(cover_image_url) = '') THEN #{coverImageUrl} ELSE cover_image_url END,
          raw_metadata = CASE
            WHEN #{source} <> 'ai'
              AND (source IS NULL OR TRIM(source) = '' OR source = 'ai' OR source_ref IS NULL OR TRIM(source_ref) = '' OR source_ref LIKE 'manual-%')
              THEN #{rawMetadata}
            WHEN raw_metadata IS NULL THEN #{rawMetadata}
            ELSE raw_metadata
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int fillMissingProviderMetadata(BookRecord record);

    @Update("""
        UPDATE books
        SET
          deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{bookId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int softDelete(@Param("bookId") Long bookId, @Param("userId") Long userId);
}
