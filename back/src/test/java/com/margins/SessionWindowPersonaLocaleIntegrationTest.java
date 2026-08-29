package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiProvider;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.ai.PlaceholderAiProvider;
import com.margins.session.business.SessionWindowBusiness;
import com.margins.session.business.SessionWindowBusiness.GeneratedAiMessage;
import com.margins.reflectionloop.ai.DiscussionDirector;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateAllMessageRequest;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationSchemaSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

@Import(SessionWindowPersonaLocaleIntegrationTest.ProviderConfiguration.class)
class SessionWindowPersonaLocaleIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired SessionWindowBusiness business;
    @Autowired DiscussionDirector director;

    @BeforeEach
    void setUp() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "SET FOREIGN_KEY_CHECKS = 0",
            "TRUNCATE TABLE ai_generation_events",
            "TRUNCATE TABLE moderation_events",
            "TRUNCATE TABLE messages",
            "TRUNCATE TABLE personas",
            "TRUNCATE TABLE session_windows",
            "TRUNCATE TABLE reading_sessions",
            "TRUNCATE TABLE books",
            "TRUNCATE TABLE users",
            "SET FOREIGN_KEY_CHECKS = 1"
        );
        IntegrationSchemaSupport.seedIntegrationUser(dataSource);
        jdbc.update("UPDATE users SET preferred_locale='ko' WHERE id=1");
        jdbc.update("INSERT INTO books (id,user_id,title,source,reading_status,is_test_data) VALUES (601,1,'Locale Book','manual','reading',TRUE)");
        jdbc.update("INSERT INTO reading_sessions (id,user_id,book_id,title,is_test_data) VALUES (601,1,601,'Locale Session',TRUE)");
        jdbc.update("INSERT INTO session_windows (id,session_id,user_id,window_type,title,position,status,is_test_data) VALUES (601,601,1,'debate','Locale',1,'open',TRUE)");
        jdbc.update("""
            INSERT INTO personas (
              id,name,display_name,system_prompt,tone,is_active,is_shared,is_test_data
            )
            VALUES
              (601,'locale-one','첫 관점','첫 관점으로 답한다.','차분함',TRUE,TRUE,TRUE),
              (602,'locale-two','둘째 관점','둘째 관점으로 답한다.','분석적',TRUE,TRUE,TRUE)
            """);
        TestSecurityContextSupport.loginAs(1L, "peacepiece");
    }

    @AfterEach
    void tearDown() {
        TestSecurityContextSupport.clear();
    }

    @Test
    void mixedPersonaBatchPersistsPerRowValidationAndAggregateMismatch() {
        business.debateAll(601L, DebateAllMessageRequest.builder()
            .content("두 관점을 비교해 주세요")
            .personaIds(List.of(601L, 602L))
            .build());

        assertThat(jdbc.queryForList(
            "SELECT persona_id, generation_locale, language_validation_outcome FROM messages WHERE window_id=601 AND role='assistant' ORDER BY id"
        )).extracting(
            row -> ((Number) row.get("persona_id")).longValue(),
            row -> row.get("generation_locale"),
            row -> row.get("language_validation_outcome")
        ).containsExactly(
            org.assertj.core.groups.Tuple.tuple(601L, "ko", "MATCH"),
            org.assertj.core.groups.Tuple.tuple(602L, "ko", "KNOWN_MISMATCH")
        );
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE task_type='PERSONA' AND generation_locale='ko' AND outcome='FALLBACK' AND language_validation_outcome='KNOWN_MISMATCH'",
            Integer.class
        )).isEqualTo(1);
    }

    @Test
    void guidedPersonaEventAndRowKeepTheGenerationLocaleSnapshot() {
        GeneratedAiMessage generated = business.generateGuidedPersonaResponse(
            601L,
            601L,
            "독자의 답변",
            null,
            "SIMPLE",
            GenerationLocale.KO
        );
        jdbc.update("UPDATE users SET preferred_locale='en' WHERE id=1");
        business.persistStandaloneGuidedPersonaResponse(601L, null, 601L, generated);

        assertThat(jdbc.queryForObject(
            "SELECT generation_locale FROM messages WHERE window_id=601 AND role='assistant'",
            String.class
        )).isEqualTo("ko");
        assertThat(jdbc.queryForObject(
            "SELECT language_validation_outcome FROM messages WHERE window_id=601 AND role='assistant'",
            String.class
        )).isEqualTo("MATCH");
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE task_type='PERSONA' AND generation_locale='ko' AND outcome='SUCCESS' AND language_validation_outcome='MATCH'",
            Integer.class
        )).isEqualTo(1);
    }

    @Test
    void guidedDirectorEventAndRowKeepTheGenerationLocaleSnapshot() {
        DiscussionGuideItemRecord current = DiscussionGuideItemRecord.builder()
            .id(1L)
            .questionId(null)
            .itemOrder(1)
            .questionText("현재 질문")
            .intent("현재 의도")
            .sourceExcerpt("제한된 근거")
            .build();
        var decision = director.decide(
            601L,
            current,
            List.of(current),
            "독자의 답변",
            "RESPOND",
            GenerationLocale.KO
        );
        jdbc.update("UPDATE users SET preferred_locale='en' WHERE id=1");
        business.persistGuidedTurnAtomically(
            601L,
            null,
            "독자의 답변",
            decision,
            null
        );

        assertThat(jdbc.queryForObject(
            "SELECT generation_locale FROM messages WHERE window_id=601 AND role='assistant'",
            String.class
        )).isEqualTo("ko");
        assertThat(jdbc.queryForObject(
            "SELECT language_validation_outcome FROM messages WHERE window_id=601 AND role='assistant'",
            String.class
        )).isEqualTo("MATCH");
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE task_type='DISCUSSION_DIRECTOR' AND generation_locale='ko' AND outcome='SUCCESS' AND language_validation_outcome='MATCH'",
            Integer.class
        )).isEqualTo(1);
    }

    @TestConfiguration
    static class ProviderConfiguration {
        @Bean
        @Primary
        AiProvider localeProvider() {
            return new PlaceholderAiProvider() {
                @Override
                public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
                    Long windowId,
                    DebateMessageRequest request,
                    AiGenerationTask task
                ) {
                    return AiGenerationResult.completed(
                        response(windowId, request.getPersonaId(), "가나다라마바사아"),
                        task, "test", "test-model", AiTokenUsage.NONE, 1, "SUCCESS", false
                    );
                }

                @Override
                public AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
                    Long windowId,
                    SendMessageRequest request,
                    AiGenerationTask task
                ) {
                    return AiGenerationResult.completed(
                        AiMessageResponse.builder()
                            .windowId(windowId)
                            .role("assistant")
                            .content("{\"action\":\"ASK_FOLLOW_UP\",\"reply\":\"답을 한 문장 더 구체화해 보세요.\",\"focus\":\"현재 쟁점\",\"candidatePersonaIds\":[]}")
                            .streamingReady(true)
                            .aiModel("test-model")
                            .build(),
                        task, "test", "test-model", AiTokenUsage.NONE, 1, "SUCCESS", false
                    );
                }

                @Override
                public AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
                    Long windowId,
                    List<DebateMessageRequest> requests,
                    AiGenerationTask task
                ) {
                    return AiGenerationResult.completed(
                        List.of(
                            response(windowId, requests.get(0).getPersonaId(), "가나다라마바사아"),
                            response(windowId, requests.get(1).getPersonaId(),
                                "this response is clearly written in english")
                        ),
                        task, "test", "test-model", AiTokenUsage.NONE, 1, "SUCCESS", false
                    );
                }

                private AiMessageResponse response(Long windowId, Long personaId, String content) {
                    return AiMessageResponse.builder()
                        .windowId(windowId)
                        .personaId(personaId)
                        .role("assistant")
                        .content(content)
                        .streamingReady(true)
                        .aiModel("test-model")
                        .build();
                }
            };
        }
    }
}
