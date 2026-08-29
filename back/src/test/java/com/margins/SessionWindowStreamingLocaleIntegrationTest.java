package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiProvider;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.PlaceholderAiProvider;
import com.margins.common.error.ApiException;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.service.SessionWindowService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationSchemaSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

@Import(SessionWindowStreamingLocaleIntegrationTest.StreamingProviderConfiguration.class)
class SessionWindowStreamingLocaleIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired SessionWindowService service;

    @BeforeEach
    void setUp() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "SET FOREIGN_KEY_CHECKS = 0",
            "TRUNCATE TABLE ai_generation_events",
            "TRUNCATE TABLE messages",
            "TRUNCATE TABLE session_windows",
            "TRUNCATE TABLE reading_sessions",
            "TRUNCATE TABLE books",
            "TRUNCATE TABLE users",
            "SET FOREIGN_KEY_CHECKS = 1"
        );
        IntegrationSchemaSupport.seedIntegrationUser(dataSource);
        jdbc.update("UPDATE users SET preferred_locale='en' WHERE id=1");
        jdbc.update("INSERT INTO books (id,user_id,title,source,reading_status,is_test_data) VALUES (501,1,'Stream Book','manual','reading',TRUE)");
        jdbc.update("INSERT INTO reading_sessions (id,user_id,book_id,title,is_test_data) VALUES (501,1,501,'Stream Session',TRUE)");
        jdbc.update("INSERT INTO session_windows (id,session_id,user_id,window_type,title,position,status,is_test_data) VALUES (501,501,1,'chat','Stream',1,'open',TRUE)");
        TestSecurityContextSupport.loginAs(1L, "peacepiece");
    }

    @AfterEach
    void tearDown() {
        TestSecurityContextSupport.clear();
    }

    @Test
    void finalMismatchRollsBackReaderAndLeavesRequiresNewEvidence() {
        List<String> deltas = new ArrayList<>();
        assertThatThrownBy(() -> service.streamMessage(
            501L,
            SendMessageRequest.builder().content("A reader message").build(),
            deltas::add
        )).isInstanceOf(ApiException.class);

        assertThat(deltas).containsExactly("반대 언어 델타");
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM messages WHERE window_id=501",
            Integer.class
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE task_type='WINDOW_MESSAGE_STREAM' AND generation_locale='en' AND language_validation_outcome='KNOWN_MISMATCH' AND outcome='FAILURE'",
            Integer.class
        )).isEqualTo(1);
    }

    @TestConfiguration
    static class StreamingProviderConfiguration {
        @Bean
        @Primary
        AiProvider mismatchedStreamingProvider() {
            return new PlaceholderAiProvider() {
                @Override
                public AiGenerationResult<AiMessageResponse> streamWindowMessageWithMetadata(
                    Long windowId,
                    SendMessageRequest request,
                    Consumer<String> deltaConsumer,
                    AiGenerationTask task
                ) {
                    deltaConsumer.accept("반대 언어 델타");
                    return AiGenerationResult.completed(
                        AiMessageResponse.builder()
                            .windowId(windowId)
                            .role("assistant")
                            .content("이 응답은 명백하게 한국어로만 작성되어 영어 계정과 일치하지 않습니다")
                            .streamingReady(true)
                            .aiModel("test-provider")
                            .build(),
                        task,
                        "test",
                        "test-provider",
                        AiTokenUsage.NONE,
                        1,
                        "SUCCESS",
                        false
                    );
                }
            };
        }
    }
}
