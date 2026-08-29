package com.margins.message.mapper;

import com.margins.message.model.MessageRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 메시지 테이블에 접근하는 MyBatis 매퍼다.
 * 세션/질문/페르소나 문맥별 대화 저장과 조회 쿼리를 담당한다.
 */
@Mapper
public interface MessageMapper {

    @Insert("""
        INSERT INTO messages (
          session_id,
          window_id,
          user_id,
          parent_message_id,
          role,
          content,
          message_order,
          ai_model,
          persona_id,
          question_id,
          context_snapshot,
          token_usage,
          streaming_status,
          generation_locale,
          language_validation_outcome,
          is_test_data
        )
        VALUES (
          #{sessionId},
          #{windowId},
          #{userId},
          #{parentMessageId},
          #{role},
          #{content},
          #{messageOrder},
          #{aiModel},
          #{personaId},
          #{questionId},
          #{contextSnapshot},
          #{tokenUsage},
          #{streamingStatus},
          #{generationLocale},
          #{languageValidationOutcome},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(MessageRecord record);

    @Select("""
        SELECT COALESCE(MAX(message_order), 0) + 1
        FROM messages
        WHERE session_id = #{sessionId}
          AND window_id = #{windowId}
          AND deleted_at IS NULL
        """)
    int selectNextOrder(@Param("sessionId") Long sessionId, @Param("windowId") Long windowId);

    @Select("""
        SELECT
          m.id,
          m.session_id,
          m.window_id,
          m.user_id,
          m.parent_message_id,
          m.role,
          m.content,
          m.message_order,
          m.ai_model,
          m.persona_id,
          m.question_id,
          m.streaming_status,
          m.generation_locale,
          m.language_validation_outcome,
          m.is_test_data,
          m.created_at
        FROM messages m
        INNER JOIN session_windows sw ON sw.id = m.window_id
        WHERE m.session_id = #{sessionId}
          AND m.deleted_at IS NULL
          AND sw.deleted_at IS NULL
        ORDER BY sw.position ASC, m.message_order ASC, m.id ASC
        """)
    List<MessageRecord> findBySessionId(Long sessionId);

    @Select("""
        SELECT
          m.id,
          m.session_id,
          m.window_id,
          m.user_id,
          m.parent_message_id,
          m.role,
          m.content,
          m.message_order,
          m.ai_model,
          m.persona_id,
          m.question_id,
          m.context_snapshot,
          m.token_usage,
          m.streaming_status,
          m.generation_locale,
          m.language_validation_outcome,
          m.is_test_data,
          m.created_at
        FROM messages m
        WHERE m.window_id = #{windowId}
          AND m.deleted_at IS NULL
          AND (#{beforeMessageId} IS NULL OR m.id < #{beforeMessageId})
        ORDER BY m.message_order DESC, m.id DESC
        LIMIT #{limit}
        """)
    List<MessageRecord> findRecentByWindowBefore(
        @Param("windowId") Long windowId,
        @Param("beforeMessageId") Long beforeMessageId,
        @Param("limit") int limit
    );

    @Select("""
        SELECT
          m.id, m.session_id, m.window_id, m.user_id, m.parent_message_id,
          m.role, m.content, m.message_order, m.ai_model, m.persona_id,
          m.question_id, m.streaming_status, m.generation_locale,
          m.language_validation_outcome, m.is_test_data, m.created_at
        FROM messages m
        WHERE m.window_id = #{windowId}
          AND m.deleted_at IS NULL
          AND (#{afterMessageId} IS NULL OR m.id > #{afterMessageId})
          AND (#{beforeMessageId} IS NULL OR m.id < #{beforeMessageId})
        ORDER BY m.message_order ASC, m.id ASC
        LIMIT #{limit}
        """)
    List<MessageRecord> findSummaryCandidates(
        @Param("windowId") Long windowId,
        @Param("afterMessageId") Long afterMessageId,
        @Param("beforeMessageId") Long beforeMessageId,
        @Param("limit") int limit
    );

    @Select("""
        SELECT
          m.id,
          m.session_id,
          m.window_id,
          m.user_id,
          m.parent_message_id,
          m.role,
          m.content,
          m.message_order,
          m.ai_model,
          m.persona_id,
          m.question_id,
          m.streaming_status,
          m.generation_locale,
          m.language_validation_outcome,
          m.is_test_data,
          m.created_at
        FROM messages m
        INNER JOIN session_windows sw ON sw.id = m.window_id
        INNER JOIN reading_sessions rs ON rs.id = m.session_id
        WHERE m.id = #{messageId}
          AND m.user_id = #{userId}
          AND m.role = 'user'
          AND m.deleted_at IS NULL
          AND sw.deleted_at IS NULL
          AND rs.deleted_at IS NULL
        """)
    MessageRecord findEditableById(
        @Param("messageId") Long messageId,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE messages
        SET content = #{content}
        WHERE id = #{messageId}
          AND user_id = #{userId}
          AND role = 'user'
          AND deleted_at IS NULL
        """)
    int updateContent(
        @Param("messageId") Long messageId,
        @Param("userId") Long userId,
        @Param("content") String content
    );

    @Update("""
        UPDATE session_windows
        SET context_snapshot = JSON_REMOVE(
              JSON_REMOVE(context_snapshot, '$.conversationSummaries.ko'),
              '$.conversationSummaries.en'
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{windowId}
          AND deleted_at IS NULL
          AND (
            CAST(
              JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.ko.lastMessageId'))
              AS UNSIGNED
            ) >= #{messageId}
            OR CAST(
              JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.conversationSummaries.en.lastMessageId'))
              AS UNSIGNED
            ) >= #{messageId}
          )
        """)
    int invalidateConversationSummary(
        @Param("windowId") Long windowId,
        @Param("messageId") Long messageId
    );

    @Update("""
        UPDATE messages
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE user_id = #{userId}
          AND deleted_at IS NULL
          AND (
            (id = #{messageId} AND role = 'user')
            OR parent_message_id = #{messageId}
          )
        """)
    int softDelete(
        @Param("messageId") Long messageId,
        @Param("userId") Long userId
    );
}
