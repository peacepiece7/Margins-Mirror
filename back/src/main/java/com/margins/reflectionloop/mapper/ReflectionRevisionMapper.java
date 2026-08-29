package com.margins.reflectionloop.mapper;

import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.session.model.SessionInsightRecord;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ReflectionRevisionMapper {

    @Select("""
        SELECT id
        FROM reading_sessions
        WHERE id = #{sessionId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        FOR UPDATE
        """)
    Long lockOwnedSession(@Param("sessionId") Long sessionId, @Param("userId") Long userId);

    @Select("""
        SELECT id, session_id, user_id, question_id, insight_type, title, content, evidence,
               author_name, visibility, reviewed_on, insight_order, created_at, updated_at, is_test_data
        FROM session_insights
        WHERE session_id = #{sessionId}
          AND user_id = #{userId}
          AND insight_type = 'reflection'
          AND deleted_at IS NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
        """)
    SessionInsightRecord findPrimaryReflection(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, session_id, user_id, question_id, insight_type, title, content, evidence,
               author_name, visibility, reviewed_on, insight_order, created_at, updated_at, is_test_data
        FROM session_insights
        WHERE id = #{reflectionId}
          AND user_id = #{userId}
          AND insight_type = 'reflection'
          AND deleted_at IS NULL
        """)
    SessionInsightRecord findOwnedReflection(
        @Param("reflectionId") Long reflectionId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO reflection_revisions (
          reflection_insight_id, session_id, user_id, version, content,
          revision_source, source_revision_id, is_test_data
        ) VALUES (
          #{reflectionInsightId}, #{sessionId}, #{userId}, #{version}, #{content},
          #{revisionSource}, #{sourceRevisionId}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertRevision(ReflectionRevisionRecord record);

    @Select("""
        SELECT id, reflection_insight_id, session_id, user_id, version, content,
               revision_source, source_revision_id, is_test_data, created_at
        FROM reflection_revisions
        WHERE reflection_insight_id = #{reflectionId}
          AND user_id = #{userId}
        ORDER BY version DESC
        """)
    List<ReflectionRevisionRecord> findRevisions(
        @Param("reflectionId") Long reflectionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, reflection_insight_id, session_id, user_id, version, content,
               revision_source, source_revision_id, is_test_data, created_at
        FROM reflection_revisions
        WHERE id = #{revisionId}
          AND user_id = #{userId}
        """)
    ReflectionRevisionRecord findOwnedRevision(
        @Param("revisionId") Long revisionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT COALESCE(MAX(version), 0) + 1
        FROM reflection_revisions
        WHERE reflection_insight_id = #{reflectionId}
        """)
    int nextRevisionVersion(Long reflectionId);

    @Update("""
        UPDATE session_insights
        SET title = #{title},
            content = #{content},
            evidence = #{evidence},
            author_name = #{authorName},
            visibility = #{visibility},
            reviewed_on = #{reviewedOn},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{reflectionId}
          AND session_id = #{sessionId}
          AND user_id = #{userId}
          AND insight_type = 'reflection'
          AND deleted_at IS NULL
        """)
    int updateReflectionProjection(
        @Param("reflectionId") Long reflectionId,
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId,
        @Param("title") String title,
        @Param("content") String content,
        @Param("evidence") String evidence,
        @Param("authorName") String authorName,
        @Param("visibility") String visibility,
        @Param("reviewedOn") LocalDate reviewedOn
    );
}
