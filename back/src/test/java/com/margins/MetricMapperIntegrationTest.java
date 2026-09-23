package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.metric.mapper.MetricMapper;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationSchemaSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MetricMapperIntegrationTest extends AbstractMySqlIntegrationTest {

    @Autowired
    private MetricMapper metricMapper;

    @BeforeEach
    void reset() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "SET FOREIGN_KEY_CHECKS = 0",
            "TRUNCATE TABLE messages",
            "TRUNCATE TABLE session_insights",
            "TRUNCATE TABLE questions",
            "TRUNCATE TABLE session_highlights",
            "TRUNCATE TABLE session_windows",
            "TRUNCATE TABLE reading_sessions",
            "TRUNCATE TABLE books",
            "TRUNCATE TABLE personas",
            "TRUNCATE TABLE user_consent_events",
            "TRUNCATE TABLE users",
            "SET FOREIGN_KEY_CHECKS = 1"
        );
        IntegrationSchemaSupport.seedIntegrationUser(dataSource);
    }

    @Test
    void countsEachArtifactIndependentlyAndExcludesArchivedWindowContent() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "INSERT INTO books (id, user_id, title, author, source, is_test_data) "
                + "VALUES (10, 1, 'Scale Book', 'Reader', 'manual', TRUE)",
            "INSERT INTO reading_sessions (id, user_id, book_id, title, is_test_data) "
                + "VALUES (20, 1, 10, 'Scale Session', TRUE)",
            "INSERT INTO session_windows "
                + "(id, session_id, user_id, window_type, title, position, status, is_test_data, deleted_at) VALUES "
                + "(30, 20, 1, 'question', 'Active', 1, 'open', TRUE, NULL), "
                + "(31, 20, 1, 'question', 'Archived', 2, 'open', TRUE, CURRENT_TIMESTAMP)",
            "INSERT INTO personas (id, name, display_name, system_prompt, is_test_data) "
                + "VALUES (70, 'scale-persona', 'Scale Persona', 'Prompt', TRUE)",
            "INSERT INTO questions "
                + "(id, session_id, window_id, user_id, question_text, is_test_data) VALUES "
                + "(40, 20, 30, 1, 'Answered by message?', TRUE), "
                + "(41, 20, NULL, 1, 'Answered by insight?', TRUE), "
                + "(42, 20, 31, 1, 'Archived?', TRUE)",
            "INSERT INTO session_insights "
                + "(id, session_id, user_id, question_id, insight_type, content, insight_order, is_test_data) "
                + "VALUES (50, 20, 1, 41, 'question_answer', 'Answer', 1, TRUE)",
            "INSERT INTO session_highlights "
                + "(id, session_id, book_id, user_id, quote_text, highlight_order, is_test_data, deleted_at) VALUES "
                + "(80, 20, 10, 1, 'One', 1, TRUE, NULL), "
                + "(81, 20, 10, 1, 'Two', 2, TRUE, NULL), "
                + "(82, 20, 10, 1, 'Deleted', 3, TRUE, CURRENT_TIMESTAMP)",
            "INSERT INTO messages "
                + "(id, session_id, window_id, user_id, role, content, message_order, question_id, persona_id, is_test_data) VALUES "
                + "(60, 20, 30, 1, 'user', 'Answer', 1, 40, NULL, TRUE), "
                + "(61, 20, 30, 1, 'assistant', 'Reply', 2, NULL, 70, TRUE), "
                + "(62, 20, 31, 1, 'user', 'Archived answer', 1, 42, NULL, TRUE)"
        );

        var source = metricMapper.findSessionSource(20L, 1L);

        assertThat(source).isNotNull();
        assertThat(source.getWindowCount()).isEqualTo(1);
        assertThat(source.getQuestionCount()).isEqualTo(2);
        assertThat(source.getAnsweredQuestionCount()).isEqualTo(2);
        assertThat(source.getHighlightCount()).isEqualTo(2);
        assertThat(source.getMessageCount()).isEqualTo(2);
        assertThat(source.getPersonaCount()).isEqualTo(1);
    }
}
