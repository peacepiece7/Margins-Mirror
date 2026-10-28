package com.margins.book.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BookBackgroundMapper {
    /** 활성 소유 책의 예상 버전이 일치할 때만 개인 설명을 갱신한다. */
    @Update("""
        UPDATE books
        SET background_summary=#{summary}, background_revision=background_revision+1,
            background_updated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id=#{bookId} AND user_id=#{userId} AND deleted_at IS NULL
          AND background_revision=#{expectedRevision}
        """)
    int update(
        @Param("bookId") Long bookId,
        @Param("userId") Long userId,
        @Param("summary") String summary,
        @Param("expectedRevision") int expectedRevision
    );
}
