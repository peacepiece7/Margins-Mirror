package com.margins.moderation.mapper;

import com.margins.moderation.model.ModerationEventRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
/** 판정 event, compact timeline projection과 식별자 없는 일별 집계를 영속화한다. */
public interface ModerationEventMapper {

    @Insert("""
        INSERT INTO moderation_events (
          request_id, user_id, book_id, session_id, window_id, message_id,
          input_text, decision, intent, relevance_score, confidence,
          reason_code, suggested_question, model, policy_version, prompt_version,
          schema_version, latency_ms, fallback_used, routing_outcome,
          persona_called, provider_error_code, generation_locale,
          language_validation_outcome, is_test_data
        ) VALUES (
          #{requestId}, #{userId}, #{bookId}, #{sessionId}, #{windowId}, #{messageId},
          #{inputText}, #{decision}, #{intent}, #{relevanceScore}, #{confidence},
          #{reasonCode}, #{suggestedQuestion}, #{model}, #{policyVersion}, #{promptVersion},
          #{schemaVersion}, #{latencyMs}, #{fallbackUsed}, #{routingOutcome},
          #{personaCalled}, #{providerErrorCode}, #{generationLocale},
          #{languageValidationOutcome}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ModerationEventRecord record);

    @Insert("""
        INSERT INTO moderation_daily_aggregates (
          aggregate_date, decision, intent, reason_code, model, prompt_version,
          fallback_used, is_test_data, event_count, persona_called_count,
          related_feedback_count, not_related_feedback_count, latency_sum_ms, latency_max_ms
        ) VALUES (
          CURRENT_DATE, #{decision}, #{intent}, #{reasonCode}, #{model}, #{promptVersion},
          #{fallbackUsed}, #{testData}, 1, 0, 0, 0, #{latencyMs}, #{latencyMs}
        )
        ON DUPLICATE KEY UPDATE
          event_count = event_count + 1,
          latency_sum_ms = latency_sum_ms + VALUES(latency_sum_ms),
          latency_max_ms = GREATEST(latency_max_ms, VALUES(latency_max_ms))
        """)
    int incrementEventAggregate(ModerationEventRecord record);

    @Update("""
        UPDATE moderation_events
        SET message_id = #{messageId},
            routing_outcome = #{routingOutcome},
            persona_called = #{personaCalled}
        WHERE id = #{eventId}
        """)
    int updateRouting(
        @Param("eventId") Long eventId,
        @Param("messageId") Long messageId,
        @Param("routingOutcome") String routingOutcome,
        @Param("personaCalled") boolean personaCalled
    );

    @Update("""
        UPDATE moderation_daily_aggregates aggregate_row
        INNER JOIN moderation_events event_row
          ON aggregate_row.aggregate_date = DATE(event_row.created_at)
          AND aggregate_row.decision = event_row.decision
          AND aggregate_row.intent = event_row.intent
          AND aggregate_row.reason_code = event_row.reason_code
          AND aggregate_row.model = event_row.model
          AND aggregate_row.prompt_version = event_row.prompt_version
          AND aggregate_row.fallback_used = event_row.fallback_used
          AND aggregate_row.is_test_data = event_row.is_test_data
        SET aggregate_row.persona_called_count = aggregate_row.persona_called_count + 1
        WHERE event_row.id = #{id}
        """)
    int incrementPersonaCalledAggregate(ModerationEventRecord record);

    @Select("""
        SELECT
          id, request_id, user_id, book_id, session_id, window_id, message_id,
          input_text, decision, intent, relevance_score, confidence,
          reason_code, suggested_question, model, policy_version, prompt_version,
          schema_version, latency_ms, fallback_used, routing_outcome,
          persona_called, provider_error_code, user_feedback, is_test_data,
          generation_locale, language_validation_outcome,
          created_at, updated_at
        FROM moderation_events
        WHERE id = #{eventId}
          AND user_id = #{userId}
        """)
    ModerationEventRecord findByIdAndUserId(
        @Param("eventId") Long eventId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT
          id, request_id, user_id, book_id, session_id, window_id, message_id,
          decision, intent, reason_code, suggested_question, model,
          policy_version, prompt_version, schema_version, latency_ms,
          fallback_used, routing_outcome, persona_called, provider_error_code,
          generation_locale, language_validation_outcome,
          user_feedback, is_test_data, created_at, updated_at
        FROM moderation_events
        WHERE session_id = #{sessionId}
          AND user_id = #{userId}
          AND decision IN ('REDIRECT', 'REJECT')
        ORDER BY created_at ASC, id ASC
        """)
    List<ModerationEventRecord> findTimelineBySessionIdAndUserId(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE moderation_events
        SET user_feedback = #{feedback}
        WHERE id = #{eventId}
          AND user_id = #{userId}
          AND user_feedback IS NULL
        """)
    int setFirstFeedback(
        @Param("eventId") Long eventId,
        @Param("userId") Long userId,
        @Param("feedback") String feedback
    );

    @Update("""
        UPDATE moderation_daily_aggregates aggregate_row
        INNER JOIN moderation_events event_row
          ON aggregate_row.aggregate_date = DATE(event_row.created_at)
          AND aggregate_row.decision = event_row.decision
          AND aggregate_row.intent = event_row.intent
          AND aggregate_row.reason_code = event_row.reason_code
          AND aggregate_row.model = event_row.model
          AND aggregate_row.prompt_version = event_row.prompt_version
          AND aggregate_row.fallback_used = event_row.fallback_used
          AND aggregate_row.is_test_data = event_row.is_test_data
        SET aggregate_row.related_feedback_count = aggregate_row.related_feedback_count
              + CASE WHEN #{feedback} = 'RELATED' THEN 1 ELSE 0 END,
            aggregate_row.not_related_feedback_count = aggregate_row.not_related_feedback_count
              + CASE WHEN #{feedback} = 'NOT_RELATED' THEN 1 ELSE 0 END
        WHERE event_row.id = #{event.id}
        """)
    int incrementFeedbackAggregate(
        @Param("event") ModerationEventRecord event,
        @Param("feedback") String feedback
    );
}
