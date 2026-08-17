package com.margins.session.mapper;

import com.margins.session.model.ReviewCommentRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 리뷰 댓글 테이블에 접근하는 MyBatis 매퍼다.
 * 공개 리뷰 댓글의 생성, 목록 조회, 수정, 삭제 쿼리를 담당한다.
 */
@Mapper
public interface ReviewCommentMapper {

    @Insert("""
        INSERT INTO review_comments (
          insight_id,
          user_id,
          parent_comment_id,
          content,
          is_test_data
        )
        VALUES (
          #{insightId},
          #{userId},
          #{parentCommentId},
          #{content},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ReviewCommentRecord record);

    @Select("""
        SELECT COUNT(*)
        FROM session_insights si
        INNER JOIN reading_sessions rs ON rs.id = si.session_id
        INNER JOIN books b ON b.id = rs.book_id
        WHERE si.id = #{insightId}
          AND si.insight_type = 'reflection'
          AND si.visibility = 'PUBLIC'
          AND si.deleted_at IS NULL
          AND rs.deleted_at IS NULL
          AND b.deleted_at IS NULL
        """)
    int countPublicReview(Long insightId);

    @Select("""
        SELECT COUNT(*)
        FROM review_comments
        WHERE id = #{parentCommentId}
          AND insight_id = #{insightId}
          AND deleted_at IS NULL
        """)
    int countActiveParent(
        @Param("insightId") Long insightId,
        @Param("parentCommentId") Long parentCommentId
    );

    @Select("""
        SELECT
          rc.id,
          rc.insight_id,
          rc.user_id,
          rc.parent_comment_id,
          u.display_name AS author_name,
          rc.content,
          rc.created_at,
          rc.updated_at,
          rc.is_test_data
        FROM review_comments rc
        INNER JOIN users u ON u.id = rc.user_id
        WHERE rc.insight_id = #{insightId}
          AND rc.deleted_at IS NULL
          AND u.deleted_at IS NULL
        ORDER BY COALESCE(rc.parent_comment_id, rc.id) ASC,
          rc.parent_comment_id IS NOT NULL ASC,
          rc.created_at ASC,
          rc.id ASC
        """)
    List<ReviewCommentRecord> findByInsightId(Long insightId);

    @Update("""
        UPDATE review_comments
        SET content = #{content}
        WHERE insight_id = #{insightId}
          AND id = #{commentId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int updateContent(
        @Param("insightId") Long insightId,
        @Param("commentId") Long commentId,
        @Param("userId") Long userId,
        @Param("content") String content
    );

    @Update("""
        UPDATE review_comments
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE insight_id = #{insightId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
          AND (
            id = #{commentId}
            OR parent_comment_id = #{commentId}
          )
        """)
    int softDelete(
        @Param("insightId") Long insightId,
        @Param("commentId") Long commentId,
        @Param("userId") Long userId
    );
}
