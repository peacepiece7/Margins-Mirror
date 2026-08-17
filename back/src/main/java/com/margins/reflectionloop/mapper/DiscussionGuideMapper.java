package com.margins.reflectionloop.mapper;

import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DiscussionGuideMapper {

    @Select("""
        SELECT id, reflection_insight_id, source_revision_id, interview_id, session_id, user_id,
               depth, purpose, facilitation_level, audience_mode, target_minutes, disclosure_mode,
               goal, issues_json, status, prompt_version, model, token_usage_json,
               generation_metadata_json, guide_version, source_guide_id, origin, is_current,
               current_interview_id, archived_at,
               is_test_data, created_at, updated_at
        FROM discussion_guides
        WHERE interview_id = #{interviewId}
          AND user_id = #{userId}
          AND is_current = TRUE
        """)
    DiscussionGuideRecord findCurrentGuideByInterview(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, reflection_insight_id, source_revision_id, interview_id, session_id, user_id,
               depth, purpose, facilitation_level, audience_mode, target_minutes, disclosure_mode,
               goal, issues_json, status, prompt_version, model, token_usage_json,
               generation_metadata_json, guide_version, source_guide_id, origin, is_current,
               current_interview_id, archived_at,
               is_test_data, created_at, updated_at
        FROM discussion_guides
        WHERE id = #{guideId}
          AND user_id = #{userId}
        """)
    DiscussionGuideRecord findOwnedGuide(
        @Param("guideId") Long guideId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT dg.id, dg.reflection_insight_id, dg.source_revision_id, dg.interview_id,
               dg.session_id, dg.user_id, dg.depth, dg.purpose, dg.facilitation_level, dg.audience_mode,
               dg.target_minutes, dg.disclosure_mode, dg.goal, dg.issues_json, dg.status,
               dg.prompt_version, dg.model, dg.token_usage_json, dg.generation_metadata_json,
               dg.guide_version, dg.source_guide_id, dg.origin, dg.is_current,
               dg.current_interview_id, dg.archived_at,
               EXISTS (
                 SELECT 1
                 FROM discussion_runs dr
                 WHERE dr.guide_id = dg.id
                   AND dr.user_id = #{userId}
               ) AS has_run,
               dg.is_test_data, dg.created_at, dg.updated_at
        FROM discussion_guides dg
        WHERE dg.interview_id = #{interviewId}
          AND dg.user_id = #{userId}
        ORDER BY dg.guide_version DESC
        """)
    List<DiscussionGuideRecord> findGuideVersionsByInterview(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id
        FROM discussion_guides
        WHERE id = #{guideId}
          AND user_id = #{userId}
        FOR UPDATE
        """)
    Long lockOwnedGuide(
        @Param("guideId") Long guideId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO discussion_guides (
          reflection_insight_id, source_revision_id, interview_id, session_id, user_id,
          depth, purpose, facilitation_level, audience_mode, target_minutes, disclosure_mode,
          goal, issues_json, status, prompt_version, model, token_usage_json,
          generation_metadata_json, guide_version, source_guide_id, origin, is_current,
          archived_at, is_test_data
        ) VALUES (
          #{reflectionInsightId}, #{sourceRevisionId}, #{interviewId}, #{sessionId}, #{userId},
          #{depth}, #{purpose}, #{facilitationLevel}, #{audienceMode}, #{targetMinutes}, #{disclosureMode},
          #{goal}, CAST(#{issuesJson} AS JSON), #{status}, #{promptVersion},
          #{model}, #{tokenUsageJson}, CAST(#{generationMetadataJson} AS JSON),
          #{guideVersion}, #{sourceGuideId}, #{origin}, #{isCurrent}, #{archivedAt}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertGuide(DiscussionGuideRecord record);

    @Insert("""
        INSERT INTO discussion_guide_items (
          guide_id, question_id, stage, priority, item_order, intent, source_type,
          source_ref_id, source_excerpt, source_version, source_stale, source_fallback,
          sensitivity, skippable, expected_minutes,
          follow_ups_json, is_test_data
        ) VALUES (
          #{guideId}, #{questionId}, #{stage}, #{priority}, #{itemOrder}, #{intent},
          #{sourceType}, #{sourceRefId}, #{sourceExcerpt}, #{sourceVersion}, #{sourceStale},
          #{sourceFallback}, #{sensitivity}, #{skippable},
          #{expectedMinutes}, CAST(#{followUpsJson} AS JSON), #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertGuideItem(DiscussionGuideItemRecord record);

    @Select("""
        SELECT dgi.id, dgi.guide_id, dgi.question_id, q.question_text, dgi.stage,
               dgi.priority, dgi.item_order, dgi.intent, dgi.source_type,
               dgi.source_ref_id, dgi.source_excerpt, dgi.source_version,
               dgi.source_stale, dgi.source_fallback, dgi.sensitivity, dgi.skippable,
               dgi.expected_minutes, dgi.follow_ups_json, dgi.is_test_data, dgi.created_at
        FROM discussion_guide_items dgi
        INNER JOIN questions q ON q.id = dgi.question_id AND q.deleted_at IS NULL
        INNER JOIN discussion_guides dg ON dg.id = dgi.guide_id
        WHERE dgi.guide_id = #{guideId}
          AND dg.user_id = #{userId}
        ORDER BY dgi.item_order ASC
        """)
    List<DiscussionGuideItemRecord> findGuideItems(
        @Param("guideId") Long guideId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT dgi.id, dgi.guide_id, dgi.question_id, q.question_text, dgi.stage,
               dgi.priority, dgi.item_order, dgi.intent, dgi.source_type,
               dgi.source_ref_id, dgi.source_excerpt, dgi.source_version,
               dgi.source_stale, dgi.source_fallback, dgi.sensitivity, dgi.skippable,
               dgi.expected_minutes, dgi.follow_ups_json, dgi.is_test_data, dgi.created_at
        FROM discussion_guide_items dgi
        INNER JOIN questions q ON q.id = dgi.question_id AND q.deleted_at IS NULL
        INNER JOIN discussion_guides dg ON dg.id = dgi.guide_id
        WHERE dgi.id = #{itemId}
          AND dg.user_id = #{userId}
        """)
    DiscussionGuideItemRecord findOwnedGuideItem(
        @Param("itemId") Long itemId,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE discussion_guides
        SET status = #{status}
        WHERE id = #{guideId}
          AND user_id = #{userId}
          AND is_current = TRUE
        """)
    int updateGuideStatus(
        @Param("guideId") Long guideId,
        @Param("userId") Long userId,
        @Param("status") String status
    );

    @Update("""
        UPDATE discussion_guides
        SET is_current = FALSE,
            status = 'ARCHIVED',
            archived_at = CURRENT_TIMESTAMP(6)
        WHERE id = #{guideId}
          AND user_id = #{userId}
          AND is_current = TRUE
          AND guide_version = #{expectedVersion}
        """)
    int archiveCurrentGuide(
        @Param("guideId") Long guideId,
        @Param("userId") Long userId,
        @Param("expectedVersion") Integer expectedVersion
    );
}
