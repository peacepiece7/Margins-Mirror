package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.moderation.mapper.ModerationEventMapper;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ModerationPersistenceIntegrationTest extends AbstractMySqlIntegrationTest {
    private static final long USER_ID = 9101L;
    private static final long BOOK_ID = 9102L;
    private static final long SESSION_ID = 9103L;
    private static final long WINDOW_ID = 9104L;

    @Autowired JdbcTemplate jdbc;
    @Autowired ModerationEventMapper mapper;

    @BeforeEach
    void setUp() {
        cleanup();
        jdbc.update("""
            INSERT INTO users (
              id, username, display_name, email, email_verified, auth_provider, is_test_data
            ) VALUES (?, 'moderation_test', 'Moderator Test', 'moderation@test.local', TRUE, 'local', TRUE)
            """, USER_ID);
        jdbc.update("""
            INSERT INTO books (id, user_id, title, author, source, is_test_data)
            VALUES (?, ?, 'Dune', 'Frank Herbert', 'test', TRUE)
            """, BOOK_ID, USER_ID);
        jdbc.update("""
            INSERT INTO reading_sessions (id, user_id, book_id, title, is_test_data)
            VALUES (?, ?, ?, 'Moderation Session', TRUE)
            """, SESSION_ID, USER_ID, BOOK_ID);
        jdbc.update("""
            INSERT INTO session_windows (
              id, session_id, user_id, window_type, title, position, is_test_data
            ) VALUES (?, ?, ?, 'debate', '권력과 예언', 1, TRUE)
            """, WINDOW_ID, SESSION_ID, USER_ID);
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    @Test
    void storesReviewableEventAndIdentifierFreeAggregate() {
        ModerationEventRecord event = ModerationEventRecord.builder()
            .requestId(UUID.randomUUID().toString())
            .userId(USER_ID)
            .bookId(BOOK_ID)
            .sessionId(SESSION_ID)
            .windowId(WINDOW_ID)
            .inputText("오늘 저녁 메뉴 추천해줘")
            .decision("REDIRECT")
            .intent("BENIGN_OFF_TOPIC")
            .relevanceScore(0.1)
            .confidence(0.9)
            .reasonCode("OFF_TOPIC")
            .suggestedQuestion("책 속 선택을 어떻게 보셨나요?")
            .model("gpt-5.6-luna")
            .policyVersion("policy-v1")
            .promptVersion("prompt-v1")
            .schemaVersion("schema-v1")
            .latencyMs(25)
            .routingOutcome("REDIRECTED")
            .testData(true)
            .build();

        assertThat(mapper.insert(event)).isEqualTo(1);
        assertThat(mapper.incrementEventAggregate(event)).isEqualTo(1);

        ModerationEventRecord saved = mapper.findByIdAndUserId(event.getId(), USER_ID);
        assertThat(saved.getInputText()).isEqualTo("오늘 저녁 메뉴 추천해줘");
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(mapper.setFirstFeedback(event.getId(), USER_ID, "RELATED")).isEqualTo(1);
        assertThat(mapper.incrementFeedbackAggregate(saved, "RELATED")).isEqualTo(1);
        assertThat(mapper.findTimelineBySessionIdAndUserId(SESSION_ID, USER_ID))
            .singleElement()
            .extracting(ModerationEventRecord::getDecision)
            .isEqualTo("REDIRECT");
        assertThat(jdbc.queryForObject("""
            SELECT event_count FROM moderation_daily_aggregates
            WHERE decision='REDIRECT' AND intent='BENIGN_OFF_TOPIC'
              AND reason_code='OFF_TOPIC' AND model='gpt-5.6-luna'
              AND prompt_version='prompt-v1' AND is_test_data=TRUE
            """, Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("""
            SELECT related_feedback_count FROM moderation_daily_aggregates
            WHERE decision='REDIRECT' AND intent='BENIGN_OFF_TOPIC'
              AND reason_code='OFF_TOPIC' AND model='gpt-5.6-luna'
              AND prompt_version='prompt-v1' AND is_test_data=TRUE
            """, Long.class)).isEqualTo(1L);

        Integer forbiddenColumns = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE()
              AND TABLE_NAME='moderation_daily_aggregates'
              AND COLUMN_NAME IN (
                'id', 'event_id', 'request_id', 'user_id', 'book_id', 'session_id',
                'window_id', 'message_id', 'input_text', 'input_hmac'
              )
            """, Integer.class);
        assertThat(forbiddenColumns).isZero();
        assertThat(jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE()
              AND TABLE_NAME='moderation_events'
              AND COLUMN_NAME='input_hmac'
            """, Integer.class)).isZero();
    }

    private void cleanup() {
        jdbc.update("DELETE FROM moderation_events WHERE user_id=?", USER_ID);
        jdbc.update("DELETE FROM moderation_daily_aggregates WHERE is_test_data=TRUE");
        jdbc.update("DELETE FROM session_windows WHERE id=?", WINDOW_ID);
        jdbc.update("DELETE FROM reading_sessions WHERE id=?", SESSION_ID);
        jdbc.update("DELETE FROM books WHERE id=?", BOOK_ID);
        jdbc.update("DELETE FROM users WHERE id=?", USER_ID);
    }
}
