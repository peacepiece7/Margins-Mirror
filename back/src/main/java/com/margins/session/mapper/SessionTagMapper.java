package com.margins.session.mapper;

import com.margins.session.model.SessionTagRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 세션 태그 테이블에 접근하는 MyBatis 매퍼다.
 * 사용자별 독서 세션 태그 생성, 조회, 삭제 쿼리를 담당한다.
 */
@Mapper
public interface SessionTagMapper {

    @Insert("""
        INSERT INTO session_tags (
          session_id,
          user_id,
          label,
          is_test_data
        )
        VALUES (
          #{sessionId},
          #{userId},
          #{label},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(SessionTagRecord record);

    @Select("""
        SELECT id, session_id, user_id, label, is_test_data
        FROM session_tags
        WHERE session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        ORDER BY label ASC, id ASC
        """)
    List<SessionTagRecord> findBySessionId(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Select("""
        <script>
        SELECT id, session_id, user_id, label, is_test_data
        FROM session_tags
        WHERE user_id = #{userId}
          AND deleted_at IS NULL
          AND session_id IN
          <foreach collection="sessionIds" item="sessionId" open="(" separator="," close=")">
            #{sessionId}
          </foreach>
        ORDER BY session_id ASC, label ASC, id ASC
        </script>
        """)
    List<SessionTagRecord> findBySessionIds(
        @Param("sessionIds") List<Long> sessionIds,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE session_tags
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = #{tagId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int softDelete(
        @Param("sessionId") Long sessionId,
        @Param("tagId") Long tagId,
        @Param("userId") Long userId
    );
}
