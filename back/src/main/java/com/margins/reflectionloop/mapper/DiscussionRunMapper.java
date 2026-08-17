package com.margins.reflectionloop.mapper;

import com.margins.message.model.MessageRecord;
import com.margins.reflectionloop.model.DiscussionRunRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DiscussionRunMapper {

    @Select("""
        SELECT id, guide_id, window_id, session_id, user_id, current_item_id, status,
               refinement_outcome, refined_revision_id, refinement_input_hash,
               refinement_transcript_hash, refinement_prompt_version,
               refinement_suggestion_status, refinement_suggestion_content,
               refinement_generation_metadata_json, refinement_generated_at,
               director_version, last_director_action,
               pending_perspective_item_id, pending_perspective_ids_json,
               pending_perspective_claim_token, pending_perspective_claimed_at,
               is_test_data, started_at, completed_at, created_at, updated_at
        FROM discussion_runs
        WHERE guide_id = #{guideId}
          AND user_id = #{userId}
        """)
    DiscussionRunRecord findRunByGuide(
        @Param("guideId") Long guideId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT dr.id, dr.guide_id, dr.window_id, dr.session_id, dr.user_id,
               dr.current_item_id, dr.status, dr.refinement_outcome, dr.refined_revision_id,
               dr.refinement_input_hash, dr.refinement_transcript_hash,
               dr.refinement_prompt_version, dr.refinement_suggestion_status,
               dr.refinement_suggestion_content, dr.refinement_generation_metadata_json,
               dr.refinement_generated_at, dr.director_version, dr.last_director_action,
               dr.pending_perspective_item_id, dr.pending_perspective_ids_json,
               dr.pending_perspective_claim_token, dr.pending_perspective_claimed_at,
               dr.is_test_data, dr.started_at, dr.completed_at, dr.created_at, dr.updated_at
        FROM discussion_runs dr
        INNER JOIN discussion_guides dg ON dg.id = dr.guide_id
        WHERE dg.interview_id = #{interviewId}
          AND dr.user_id = #{userId}
        ORDER BY
          CASE dr.status
            WHEN 'ACTIVE' THEN 0
            WHEN 'READY' THEN 1
            ELSE 2
          END,
          dr.created_at DESC,
          dr.id DESC
        LIMIT 1
        """)
    DiscussionRunRecord findLatestRunByInterview(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, guide_id, window_id, session_id, user_id, current_item_id, status,
               refinement_outcome, refined_revision_id, refinement_input_hash,
               refinement_transcript_hash, refinement_prompt_version,
               refinement_suggestion_status, refinement_suggestion_content,
               refinement_generation_metadata_json, refinement_generated_at,
               director_version, last_director_action,
               pending_perspective_item_id, pending_perspective_ids_json,
               pending_perspective_claim_token, pending_perspective_claimed_at,
               is_test_data, started_at, completed_at, created_at, updated_at
        FROM discussion_runs
        WHERE id = #{runId}
          AND user_id = #{userId}
        """)
    DiscussionRunRecord findOwnedRun(
        @Param("runId") Long runId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id
        FROM discussion_runs
        WHERE id = #{runId}
          AND user_id = #{userId}
        FOR UPDATE
        """)
    Long lockOwnedRun(
        @Param("runId") Long runId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO discussion_runs (
          guide_id, window_id, session_id, user_id, current_item_id, status,
          director_version, is_test_data
        ) VALUES (
          #{guideId}, #{windowId}, #{sessionId}, #{userId}, #{currentItemId}, #{status},
          #{directorVersion}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertRun(DiscussionRunRecord record);

    @Update("""
        UPDATE discussion_runs
        SET current_item_id = #{currentItemId},
            status = #{status},
            last_director_action = #{lastDirectorAction},
            pending_perspective_item_id = #{pendingPerspectiveItemId},
            pending_perspective_ids_json = CAST(#{pendingPerspectiveIdsJson} AS JSON),
            pending_perspective_claim_token = #{pendingPerspectiveClaimToken},
            pending_perspective_claimed_at = #{pendingPerspectiveClaimedAt},
            started_at = CASE
              WHEN started_at IS NULL AND #{status} IN ('ACTIVE', 'COMPLETED')
              THEN CURRENT_TIMESTAMP(6)
              ELSE started_at
            END,
            completed_at = CASE
              WHEN #{status} = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP(6))
              ELSE completed_at
            END
        WHERE id = #{id}
          AND user_id = #{userId}
        """)
    int updateRunProgress(DiscussionRunRecord record);

    @Update("""
        UPDATE discussion_runs
        SET pending_perspective_claim_token = #{claimToken},
            pending_perspective_claimed_at = CURRENT_TIMESTAMP(6)
        WHERE id = #{runId}
          AND user_id = #{userId}
          AND pending_perspective_item_id = #{itemId}
          AND JSON_CONTAINS(pending_perspective_ids_json, CAST(#{personaId} AS CHAR))
          AND (
            pending_perspective_claim_token IS NULL
            OR pending_perspective_claimed_at IS NULL
            OR pending_perspective_claimed_at
              < CURRENT_TIMESTAMP(6) - INTERVAL #{claimTtlSeconds} SECOND
          )
        """)
    int claimPendingPerspective(
        @Param("runId") Long runId,
        @Param("userId") Long userId,
        @Param("itemId") Long itemId,
        @Param("personaId") Long personaId,
        @Param("claimToken") String claimToken,
        @Param("claimTtlSeconds") int claimTtlSeconds
    );

    @Update("""
        UPDATE discussion_runs
        SET current_item_id = #{currentItemId},
            status = #{status},
            last_director_action = #{lastDirectorAction},
            pending_perspective_item_id = NULL,
            pending_perspective_ids_json = NULL,
            pending_perspective_claim_token = NULL,
            pending_perspective_claimed_at = NULL,
            started_at = CASE
              WHEN started_at IS NULL AND #{status} IN ('ACTIVE', 'COMPLETED')
              THEN CURRENT_TIMESTAMP(6)
              ELSE started_at
            END,
            completed_at = CASE
              WHEN #{status} = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP(6))
              ELSE completed_at
            END
        WHERE id = #{id}
          AND user_id = #{userId}
          AND pending_perspective_claim_token = #{claimToken}
        """)
    int completeClaimedPerspectiveProgress(
        @Param("id") Long id,
        @Param("userId") Long userId,
        @Param("currentItemId") Long currentItemId,
        @Param("status") String status,
        @Param("lastDirectorAction") String lastDirectorAction,
        @Param("claimToken") String claimToken
    );

    @Update("""
        UPDATE discussion_runs
        SET current_item_id = #{currentItemId},
            status = #{status},
            last_director_action = #{lastDirectorAction},
            pending_perspective_item_id = NULL,
            pending_perspective_ids_json = NULL,
            pending_perspective_claim_token = NULL,
            pending_perspective_claimed_at = NULL,
            started_at = CASE
              WHEN started_at IS NULL AND #{status} IN ('ACTIVE', 'COMPLETED')
              THEN CURRENT_TIMESTAMP(6)
              ELSE started_at
            END,
            completed_at = CASE
              WHEN #{status} = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP(6))
              ELSE completed_at
            END
        WHERE id = #{id}
          AND user_id = #{userId}
          AND pending_perspective_item_id = #{pendingItemId}
          AND (
            pending_perspective_claim_token IS NULL
            OR pending_perspective_claimed_at IS NULL
            OR pending_perspective_claimed_at
              < CURRENT_TIMESTAMP(6) - INTERVAL #{claimTtlSeconds} SECOND
          )
        """)
    int advanceUnclaimedPerspective(
        @Param("id") Long id,
        @Param("userId") Long userId,
        @Param("currentItemId") Long currentItemId,
        @Param("status") String status,
        @Param("lastDirectorAction") String lastDirectorAction,
        @Param("pendingItemId") Long pendingItemId,
        @Param("claimTtlSeconds") int claimTtlSeconds
    );

    @Update("""
        UPDATE discussion_runs
        SET pending_perspective_claim_token = NULL,
            pending_perspective_claimed_at = NULL
        WHERE id = #{runId}
          AND user_id = #{userId}
          AND pending_perspective_claim_token = #{claimToken}
        """)
    int releasePerspectiveClaim(
        @Param("runId") Long runId,
        @Param("userId") Long userId,
        @Param("claimToken") String claimToken
    );

    @Update("""
        UPDATE discussion_runs
        SET refinement_outcome = #{refinementOutcome},
            refined_revision_id = #{refinedRevisionId},
            status = 'COMPLETED',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP(6))
        WHERE id = #{id}
          AND user_id = #{userId}
        """)
    int updateRunRefinement(DiscussionRunRecord record);

    @Update("""
        UPDATE discussion_runs
        SET refinement_input_hash = #{refinementInputHash},
            refinement_transcript_hash = #{refinementTranscriptHash},
            refinement_prompt_version = #{refinementPromptVersion},
            refinement_suggestion_status = 'PENDING',
            refinement_suggestion_content = NULL,
            refinement_generation_metadata_json = NULL,
            refinement_generated_at = NULL
        WHERE id = #{id}
          AND user_id = #{userId}
        """)
    int claimRunRefinementSuggestion(DiscussionRunRecord record);

    @Update("""
        UPDATE discussion_runs
        SET refinement_suggestion_status = #{refinementSuggestionStatus},
            refinement_suggestion_content = #{refinementSuggestionContent},
            refinement_generation_metadata_json =
              CAST(#{refinementGenerationMetadataJson} AS JSON),
            refinement_generated_at = CURRENT_TIMESTAMP(6)
        WHERE id = #{id}
          AND user_id = #{userId}
          AND refinement_input_hash = #{refinementInputHash}
          AND refinement_suggestion_status = 'PENDING'
        """)
    int finalizeRunRefinementSuggestion(DiscussionRunRecord record);

    @Select("""
        SELECT COALESCE(
          GROUP_CONCAT(m.content ORDER BY m.message_order SEPARATOR '\n\n'),
          ''
        )
        FROM messages m
        WHERE m.window_id = #{windowId}
          AND m.user_id = #{userId}
          AND m.persona_id IS NOT NULL
          AND m.deleted_at IS NULL
        """)
    String findPersonaPerspectiveSummary(
        @Param("windowId") Long windowId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT m.id, m.session_id, m.window_id, m.user_id, m.parent_message_id,
               m.role, m.content, m.message_order, m.ai_model, m.persona_id,
               m.question_id, m.streaming_status, m.is_test_data, m.created_at
        FROM messages m
        WHERE m.window_id = #{windowId}
          AND m.user_id = #{userId}
          AND m.question_id = #{questionId}
          AND m.role = 'user'
          AND m.deleted_at IS NULL
        ORDER BY m.message_order DESC, m.id DESC
        LIMIT 1
        """)
    MessageRecord findLatestUserMessage(
        @Param("windowId") Long windowId,
        @Param("userId") Long userId,
        @Param("questionId") Long questionId
    );

    @Select("""
        SELECT COUNT(*)
        FROM messages
        WHERE window_id = #{windowId}
          AND user_id = #{userId}
          AND question_id = #{questionId}
          AND role = 'assistant'
          AND persona_id IS NULL
          AND deleted_at IS NULL
        """)
    int countDirectorMessages(
        @Param("windowId") Long windowId,
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT m.id, m.session_id, m.window_id, m.user_id, m.parent_message_id,
               m.role, m.content, m.message_order, m.ai_model, m.persona_id,
               m.question_id, m.streaming_status, m.is_test_data, m.created_at
        FROM messages m
        INNER JOIN discussion_runs dr
          ON dr.window_id = m.window_id
          AND dr.user_id = m.user_id
        WHERE m.window_id = #{windowId}
          AND m.user_id = #{userId}
          AND m.deleted_at IS NULL
        ORDER BY m.message_order ASC, m.id ASC
        """)
    List<MessageRecord> findOwnedDiscussionTranscript(
        @Param("windowId") Long windowId,
        @Param("userId") Long userId
    );
}
