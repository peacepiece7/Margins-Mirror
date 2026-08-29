package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.margins.account.service.AccountLifecycleService;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.DiscussionGuideGeneration.Response;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.PlaceholderAiProvider;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.DiscussionModerator;
import com.margins.moderation.DiscussionModerationResult;
import com.margins.moderation.ModerationDecision;
import com.margins.moderation.ModerationIntent;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionListResponse;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.DiscussionRunMapper;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.dto.request.EditDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.GuideBriefRequest;
import com.margins.reflectionloop.model.dto.request.GuideItemEditRequest;
import com.margins.reflectionloop.model.dto.request.GuidedDiscussionTurnRequest;
import com.margins.reflectionloop.model.dto.request.InterviewResponseRequest;
import com.margins.reflectionloop.model.dto.request.RegenerateDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRefinementRequest;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRequest;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideResponse;
import com.margins.reflectionloop.model.dto.response.FacilitatorDiscussionGuideProjectionResponse;
import com.margins.reflectionloop.model.dto.response.ParticipantDiscussionGuideProjectionResponse;
import com.margins.reflectionloop.service.ReflectionLoopService;
import com.margins.session.service.ReadingSessionService;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationSchemaSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@TestPropertySource(properties = {
    "margins.reflection-loop.enabled=true",
    "margins.ai.moderator.enabled=true",
    "margins.ai.openai.api-key=integration-fixture-key"
})
@Import(ReflectionLoopIntegrationTest.ProviderConfiguration.class)
class ReflectionLoopIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ReflectionLoopService service;

    @Autowired
    private AccountLifecycleService accountLifecycleService;

    @Autowired
    private ReadingSessionService readingSessionService;

    @Autowired
    private CountingPlaceholderAiProvider aiProvider;

    @Autowired
    private ConfigurableDiscussionModerator moderator;

    @Autowired
    private ReflectionRevisionMapper reflectionRevisionMapper;

    @Autowired
    private ReflectionInterviewMapper reflectionInterviewMapper;

    @Autowired
    private DiscussionGuideMapper discussionGuideMapper;

    @Autowired
    private DiscussionRunMapper discussionRunMapper;

    @BeforeEach
    void resetAndSeedSession() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "SET FOREIGN_KEY_CHECKS = 0",
            "TRUNCATE TABLE ai_generation_events",
            "TRUNCATE TABLE moderation_events",
            "TRUNCATE TABLE moderation_daily_aggregates",
            "TRUNCATE TABLE discussion_run_refinements",
            "TRUNCATE TABLE discussion_runs",
            "TRUNCATE TABLE discussion_guide_items",
            "TRUNCATE TABLE discussion_guides",
            "TRUNCATE TABLE messages",
            "TRUNCATE TABLE reflection_interview_answer_revisions",
            "TRUNCATE TABLE reflection_summaries",
            "TRUNCATE TABLE session_insights",
            "TRUNCATE TABLE questions",
            "TRUNCATE TABLE reflection_interviews",
            "TRUNCATE TABLE reflection_revisions",
            "TRUNCATE TABLE session_highlights",
            "TRUNCATE TABLE personas",
            "TRUNCATE TABLE session_windows",
            "TRUNCATE TABLE reading_sessions",
            "TRUNCATE TABLE books",
            "TRUNCATE TABLE book_knowledge",
            "TRUNCATE TABLE users",
            "SET FOREIGN_KEY_CHECKS = 1"
        );
        IntegrationSchemaSupport.seedIntegrationUser(dataSource);
        aiProvider.resetRefinement();
        moderator.allow();
        jdbc.update("""
            INSERT INTO books (
              id, user_id, title, author, source, reading_status, is_test_data
            ) VALUES (100, 1, 'Integration Reflection Book', 'Test Author', 'manual', 'reading', TRUE)
            """);
        jdbc.update("""
            INSERT INTO reading_sessions (
              id, user_id, book_id, title, is_test_data
            ) VALUES (100, 1, 100, 'Reflection Loop Session', TRUE)
            """);
        jdbc.update("""
            INSERT INTO personas (
              name, display_name, system_prompt, tone, created_by_user_id, is_active, is_test_data
            ) VALUES (
              'integration-reader', '통합 관점', '책의 근거로 다른 관점을 제시한다.',
              '차분함', 1, TRUE, TRUE
            )
            """);
        TestSecurityContextSupport.loginAs(1L, "peacepiece");
    }

    @AfterEach
    void clearAuthentication() {
        TestSecurityContextSupport.clear();
    }

    @Test
    void completesReflectionInterviewGuideDiscussionAndKeepWithoutDuplicateRevision() {
        CompletedLoop loop = completeLoop();

        var refinement = service.complete(loop.runId(), null);
        assertThat(refinement.getSuggestedContent()).isNull();
        assertThat(refinement.getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(service.complete(loop.runId(), null).getSuggestedContent())
            .isEqualTo(refinement.getSuggestedContent());
        assertThat(service.refinement(loop.runId()).getSuggestedContent())
            .isEqualTo(refinement.getSuggestedContent());
        assertThat(aiProvider.refinementCalls()).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM ai_generation_events
            WHERE task_type='REFLECTION_REFINEMENT'
            """,
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbc.queryForMap(
            """
            SELECT generation_locale, status, CHAR_LENGTH(input_hash) AS input_hash_length,
                   CHAR_LENGTH(transcript_hash) AS transcript_hash_length
            FROM discussion_run_refinements
            WHERE run_id=?
            """,
            loop.runId()
        )).containsEntry("generation_locale", "en")
            .containsEntry("status", "FAILED")
            .containsEntry("input_hash_length", 64L)
            .containsEntry("transcript_hash_length", 64L);
        assertThat(jdbc.queryForMap(
            """
            SELECT status, suggestion_content, generation_metadata_json
            FROM discussion_run_refinements
            WHERE run_id=? AND generation_locale='en'
            """,
            loop.runId()
        )).containsEntry("status", "FAILED")
            .containsEntry("suggestion_content", null)
            .doesNotContainEntry("generation_metadata_json", null);
        assertThat(jdbc.queryForList(
            "SELECT DISTINCT task_type FROM ai_generation_events",
            String.class
        )).contains(
            "INTERVIEW",
            "DISCUSSION_GUIDE",
            "DISCUSSION_DIRECTOR",
            "PERSONA",
            "MODERATOR",
            "REFLECTION_REFINEMENT"
        );
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE depth='SIMPLE' AND is_test_data=TRUE",
            Integer.class
        )).isGreaterThanOrEqualTo(6);
        var kept = service.refine(loop.runId(), SaveReflectionRefinementRequest.builder()
            .mode("KEPT")
            .outcome("KEPT")
            .build());

        assertThat(kept.getRevisions()).hasSize(1);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM session_insights WHERE insight_type='question_answer' AND visibility='PRIVATE'",
            Integer.class
        )).isEqualTo(3);
        assertThat(jdbc.queryForObject(
            "SELECT refinement_outcome FROM discussion_runs WHERE id=?",
            String.class,
            loop.runId()
        )).isEqualTo("KEPT");

        var edited = service.updateReflection(loop.reflectionId(), SaveReflectionRequest.builder()
            .content("계정 삭제 전 self-referencing revision 정합성을 확인하기 위한 두 번째 생각이다.")
            .visibility("PUBLIC")
            .build());
        assertThat(edited.getRevisions()).hasSize(2);
        assertThat(readingSessionService.findPublicReviews().getReviews())
            .singleElement()
            .satisfies(review -> {
                assertThat(review.getInsightId()).isEqualTo(loop.reflectionId());
                assertThat(review.getContent()).isEqualTo(
                    "계정 삭제 전 self-referencing revision 정합성을 확인하기 위한 두 번째 생각이다."
                );
            });

        jdbc.update("""
            INSERT INTO reflection_summaries (
              reflection_insight_id, generation_locale, source_hash, summary, model,
              language_validation_outcome, is_test_data
            ) VALUES (?, 'en', REPEAT('s', 64), 'cached reflection summary', 'test-model', 'UNKNOWN', TRUE)
            """, loop.reflectionId());

        Instant now = Instant.parse("2026-08-01T00:00:00Z");
        jdbc.update("""
            UPDATE users
            SET account_status='RESIGNED',
                personal_data_purge_scheduled_at=?,
                erase_activity_on_purge=TRUE
            WHERE id=1
            """, java.sql.Timestamp.from(now.minusSeconds(60)));
        accountLifecycleService.purgeOne(1L, now);

        assertThat(jdbc.queryForObject(
            """
            SELECT
              (SELECT COUNT(*) FROM reflection_revisions WHERE user_id=1)
              + (SELECT COUNT(*) FROM reflection_interviews WHERE user_id=1)
              + (SELECT COUNT(*) FROM discussion_guides WHERE user_id=1)
              + (SELECT COUNT(*) FROM discussion_runs WHERE user_id=1)
            """,
            Integer.class
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_run_refinements WHERE run_id=?",
            Integer.class,
            loop.runId()
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM reflection_summaries WHERE reflection_insight_id=?",
            Integer.class,
            loop.reflectionId()
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE is_test_data=TRUE",
            Integer.class
        )).isGreaterThan(0);
    }

    @Test
    void refinementCacheIdentityIsSeparatedByPreferredLocale() {
        CompletedLoop loop = completeLoop();

        var english = service.complete(loop.runId(), null);
        jdbc.update("UPDATE users SET preferred_locale='ko' WHERE id=1");
        var korean = service.refinement(loop.runId());

        assertThat(english.getSuggestedContent()).isNull();
        assertThat(korean.getSuggestedContent()).isNull();
        assertThat(english.getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(korean.getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(aiProvider.refinementCalls()).isEqualTo(2);
        assertThat(jdbc.queryForList(
            "SELECT generation_locale FROM discussion_run_refinements WHERE run_id=? ORDER BY generation_locale",
            String.class,
            loop.runId()
        )).containsExactly("en", "ko");
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_run_refinements WHERE run_id=? AND status='FAILED' AND suggestion_content IS NULL",
            Integer.class,
            loop.runId()
        )).isEqualTo(2);
    }

    @Test
    void discussionStructureRedirectOffersPersonaWithoutSavingBlockedReaderMessage() {
        moderator.discussionStructure();
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        var run = service.createRun(prepared.guide().getGuideId());

        var blocked = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("나말고 다른 사람은 없어요?")
            .navigation("RESPOND")
            .build());

        assertThat(blocked.getModeration().getDecision()).isEqualTo("REDIRECT");
        assertThat(blocked.getModeration().getIntent()).isEqualTo("DISCUSSION_STRUCTURE");
        assertThat(blocked.getModeration().getSuggestedQuestion()).contains("Me + Director");
        assertThat(blocked.getMessages()).isEmpty();
        assertThat(blocked.isPerspectiveSelectionRequired()).isTrue();
        assertThat(blocked.getPerspectiveCandidates()).isNotEmpty();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM messages WHERE window_id=? AND role='user'",
            Integer.class,
            run.getWindowId()
        )).isZero();

        var selected = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .personaId(blocked.getPerspectiveCandidates().get(0).getPersonaId())
            .navigation("SELECT_PERSPECTIVE")
            .build());

        assertThat(selected.isPerspectiveSelectionRequired()).isFalse();
        assertThat(selected.getMessages()).singleElement().satisfies(message -> {
            assertThat(message.getRole()).isEqualTo("assistant");
            assertThat(message.getPersonaId()).isNotNull();
        });
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM messages WHERE window_id=? AND role='user'",
            Integer.class,
            run.getWindowId()
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT parent_message_id FROM messages WHERE window_id=? AND persona_id IS NOT NULL",
            Long.class,
            run.getWindowId()
        )).isNull();
    }

    @Test
    void perspectiveProviderFailurePreservesChoiceForManualRetry() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        var run = service.createRun(prepared.guide().getGuideId());
        var firstTurn = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("이 장면은 서로 다른 해석이 함께 가능해서 한 가지 결론으로 닫기 어렵습니다.")
            .navigation("RESPOND")
            .build());
        Long personaId = firstTurn.getPerspectiveCandidates().get(0).getPersonaId();
        int messagesAfterDirector = jdbc.queryForObject(
            "SELECT COUNT(*) FROM messages WHERE window_id=?",
            Integer.class,
            run.getWindowId()
        );

        assertThat(firstTurn.isPerspectiveSelectionRequired()).isTrue();
        assertThat(aiProvider.personaCalls()).isZero();

        aiProvider.failNextPersona();
        assertThatThrownBy(() -> service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .personaId(personaId)
            .navigation("SELECT_PERSPECTIVE")
            .build()))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).getCode())
                .isEqualTo(ApiErrorCode.COMMON_UPSTREAM_ERROR));

        var pendingRun = service.run(run.getRunId());
        assertThat(pendingRun.isPerspectiveSelectionRequired()).isTrue();
        assertThat(pendingRun.getPerspectiveCandidates())
            .extracting(candidate -> candidate.getPersonaId())
            .containsExactly(personaId);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM messages WHERE window_id=?",
            Integer.class,
            run.getWindowId()
        )).isEqualTo(messagesAfterDirector);

        var retried = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .personaId(personaId)
            .navigation("SELECT_PERSPECTIVE")
            .build());
        assertThat(retried.isPerspectiveSelectionRequired()).isFalse();
        assertThat(aiProvider.personaCalls()).isEqualTo(2);
    }

    @Test
    void configuredProviderFallbackPreservesChoiceForManualRetry() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        var run = service.createRun(prepared.guide().getGuideId());
        var firstTurn = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("한 장면을 두 방향으로 읽을 수 있어 어느 관점이 더 생산적인지 확인하고 싶습니다.")
            .navigation("RESPOND")
            .build());
        Long personaId = firstTurn.getPerspectiveCandidates().get(0).getPersonaId();

        aiProvider.fallbackNextPersona();
        assertThatThrownBy(() -> service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .personaId(personaId)
            .navigation("SELECT_PERSPECTIVE")
            .build()))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).getCode())
                .isEqualTo(ApiErrorCode.COMMON_UPSTREAM_ERROR));

        var pendingRun = service.run(run.getRunId());
        assertThat(pendingRun.isPerspectiveSelectionRequired()).isTrue();
        assertThat(pendingRun.getPerspectiveCandidates())
            .extracting(candidate -> candidate.getPersonaId())
            .containsExactly(personaId);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM messages WHERE window_id=? AND persona_id IS NOT NULL",
            Integer.class,
            run.getWindowId()
        )).isZero();
    }

    @Test
    void concurrentPerspectiveSelectionClaimsOneProviderCall() throws Exception {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        var run = service.createRun(prepared.guide().getGuideId());
        var firstTurn = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("두 관점이 모두 가능해서 선택의 근거를 더 살펴보고 싶습니다.")
            .navigation("RESPOND")
            .build());
        Long personaId = firstTurn.getPerspectiveCandidates().get(0).getPersonaId();
        aiProvider.blockNextPersonaCall();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<?> first = CompletableFuture.supplyAsync(
                () -> {
                    TestSecurityContextSupport.loginAs(1L, "peacepiece");
                    try {
                        return service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
                            .personaId(personaId)
                            .navigation("SELECT_PERSPECTIVE")
                            .build());
                    } finally {
                        TestSecurityContextSupport.clear();
                    }
                },
                executor
            );
            if (!aiProvider.awaitPersonaStarted()) {
                try {
                    first.get(5, TimeUnit.SECONDS);
                } catch (ExecutionException exception) {
                    throw new AssertionError("First Persona selection failed before provider call", exception.getCause());
                }
                throw new AssertionError("First Persona selection did not reach the provider");
            }
            CompletableFuture<?> second = CompletableFuture.supplyAsync(
                () -> {
                    TestSecurityContextSupport.loginAs(1L, "peacepiece");
                    try {
                        return service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
                            .personaId(personaId)
                            .navigation("SELECT_PERSPECTIVE")
                            .build());
                    } finally {
                        TestSecurityContextSupport.clear();
                    }
                },
                executor
            );

            ExecutionException secondFailure = assertThrows(
                ExecutionException.class,
                () -> second.get(5, TimeUnit.SECONDS)
            );
            assertThat(secondFailure.getCause())
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getCode())
                    .isEqualTo(ApiErrorCode.COMMON_CONFLICT));

            aiProvider.releasePersonaCall();
            first.get(5, TimeUnit.SECONDS);
            assertThat(aiProvider.personaCalls()).isEqualTo(1);
            assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM ai_generation_events WHERE task_type='PERSONA'",
                Integer.class
            )).isEqualTo(1);
        } finally {
            aiProvider.releasePersonaCall();
            executor.shutdownNow();
        }
    }

    @Test
    void splitMappersReloadEveryPersistedAggregateWithOwnershipBoundaries() {
        CompletedLoop loop = completeLoop();

        var run = discussionRunMapper.findOwnedRun(loop.runId(), 1L);
        var guide = discussionGuideMapper.findOwnedGuide(run.getGuideId(), 1L);
        var interview = reflectionInterviewMapper.findOwnedInterview(
            guide.getInterviewId(),
            1L
        );
        var revisions = reflectionRevisionMapper.findRevisions(loop.reflectionId(), 1L);

        assertThat(revisions)
            .singleElement()
            .satisfies(revision -> {
                assertThat(revision.getReflectionInsightId()).isEqualTo(loop.reflectionId());
                assertThat(revision.getVersion()).isEqualTo(1);
            });
        assertThat(reflectionInterviewMapper.findAnsweredInterviewQuestions(
            interview.getId(),
            1L
        ))
            .hasSize(3);
        assertThat(discussionGuideMapper.findGuideItems(guide.getId(), 1L))
            .hasSize(5);
        assertThat(discussionRunMapper.findOwnedDiscussionTranscript(run.getWindowId(), 1L))
            .isNotEmpty()
            .isSortedAccordingTo(java.util.Comparator
                .comparing(MessageRecord::getMessageOrder)
                .thenComparing(MessageRecord::getId));

        assertThat(reflectionRevisionMapper.findOwnedReflection(loop.reflectionId(), 999L))
            .isNull();
        assertThat(reflectionInterviewMapper.findOwnedInterview(interview.getId(), 999L))
            .isNull();
        assertThat(discussionGuideMapper.findOwnedGuide(guide.getId(), 999L))
            .isNull();
        assertThat(discussionRunMapper.findOwnedRun(run.getId(), 999L))
            .isNull();
    }

    @Test
    void savesDiscussionRefinementAsASecondImmutableRevision() {
        CompletedLoop loop = completeLoop();
        service.complete(loop.runId(), null);

        var refined = service.refine(loop.runId(), SaveReflectionRefinementRequest.builder()
            .mode("EDITED")
            .outcome("DEEPENED")
            .finalContent("토론 뒤에는 침묵을 회피와 보호 중 하나로 고르기보다 두 책임의 긴장으로 읽게 되었다.")
            .build());

        assertThat(refined.getCurrentRevision().getVersion()).isEqualTo(2);
        assertThat(refined.getCurrentRevision().getRevisionSource()).isEqualTo("DISCUSSION_REFINE");
        assertThat(refined.getRevisions()).hasSize(2);
        assertThat(refined.getCurrentRevision().getContent())
            .isEqualTo("토론 뒤에는 침묵을 회피와 보호 중 하나로 고르기보다 두 책임의 긴장으로 읽게 되었다.");
        assertThat(jdbc.queryForObject(
            "SELECT refinement_outcome FROM discussion_runs WHERE id=?",
            String.class,
            loop.runId()
        )).isEqualTo("DEEPENED");
    }

    @Test
    void refinementFallbackDoesNotReadOrOverwriteLegacySingleSlot() {
        CompletedLoop loop = completeLoop();
        jdbc.update(
            """
            UPDATE discussion_runs
            SET refinement_suggestion_status='READY',
                refinement_input_hash=REPEAT('l', 64),
                refinement_transcript_hash=REPEAT('t', 64),
                refinement_prompt_version='legacy-refinement',
                refinement_suggestion_content='legacy suggestion',
                refinement_generation_metadata_json='{}',
                refinement_generated_at=CURRENT_TIMESTAMP(6)
            WHERE id=?
            """,
            loop.runId()
        );

        var failed = service.complete(loop.runId(), null);

        assertThat(failed.getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(failed.getSuggestedContent()).isNull();
        assertThat(jdbc.queryForMap(
            """
            SELECT refinement_suggestion_status, refinement_input_hash,
                   refinement_transcript_hash, refinement_prompt_version,
                   refinement_suggestion_content, refinement_generation_metadata_json
            FROM discussion_runs
            WHERE id=?
            """,
            loop.runId()
        )).containsEntry("refinement_suggestion_status", "READY")
            .containsEntry("refinement_input_hash", "l".repeat(64))
            .containsEntry("refinement_transcript_hash", "t".repeat(64))
            .containsEntry("refinement_prompt_version", "legacy-refinement")
            .containsEntry("refinement_suggestion_content", "legacy suggestion")
            .containsEntry("refinement_generation_metadata_json", "{}");
    }

    @Test
    void migration054RejectsBlankReadyRefinementContent() {
        CompletedLoop loop = completeLoop();

        assertThatThrownBy(() -> jdbc.update(
            """
            INSERT INTO discussion_run_refinements (
              run_id, generation_locale, input_hash, transcript_hash, prompt_version,
              status, suggestion_content, is_test_data, generated_at
            ) VALUES (?, 'en', REPEAT('b', 64), REPEAT('t', 64), 'blank-check',
                      'READY', '   ', TRUE, CURRENT_TIMESTAMP(6))
            """,
            loop.runId()
        )).isInstanceOf(DataAccessException.class);
    }

    @Test
    void reusesFailedRefinementWithoutFakeSuggestionAndStillAllowsKeep() {
        CompletedLoop loop = completeLoop();
        aiProvider.failRefinement();

        var failed = service.complete(loop.runId(), null);

        assertThat(failed.getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(failed.getSuggestedContent()).isNull();
        assertThat(service.refinement(loop.runId()).getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(service.complete(loop.runId(), null).getSuggestedContent()).isNull();
        assertThat(aiProvider.refinementCalls()).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM discussion_run_refinements
            WHERE run_id=?
              AND generation_locale='en'
              AND status='FAILED'
              AND suggestion_content IS NULL
              AND generation_metadata_json IS NOT NULL
            """,
            Integer.class,
            loop.runId()
        )).isEqualTo(1);

        var kept = service.refine(loop.runId(), SaveReflectionRefinementRequest.builder()
            .mode("KEPT")
            .outcome("KEPT")
            .build());
        assertThat(kept.getRevisions()).hasSize(1);
    }

    @Test
    void changedTranscriptCreatesOneNewRefinementAttempt() {
        CompletedLoop loop = completeLoop();
        var first = service.complete(loop.runId(), null);
        String firstInputHash = jdbc.queryForObject(
            "SELECT input_hash FROM discussion_run_refinements WHERE run_id=? AND generation_locale='en' ORDER BY id LIMIT 1",
            String.class,
            loop.runId()
        );

        jdbc.update(
            """
            INSERT INTO messages (
              session_id, window_id, user_id, role, content, message_order,
              streaming_status, is_test_data
            )
            SELECT session_id, window_id, user_id, 'user',
                   '완료 뒤 transcript 변경을 검증하는 추가 기록', 999,
                   'complete', is_test_data
            FROM discussion_runs
            WHERE id=?
            """,
            loop.runId()
        );

        var regenerated = service.refinement(loop.runId());
        String nextInputHash = jdbc.queryForObject(
            "SELECT input_hash FROM discussion_run_refinements WHERE run_id=? AND generation_locale='en' ORDER BY id DESC LIMIT 1",
            String.class,
            loop.runId()
        );

        assertThat(regenerated.getSuggestionStatus()).isEqualTo("FAILED");
        assertThat(regenerated.getSuggestedContent()).isNull();
        assertThat(nextInputHash).isNotEqualTo(firstInputHash);
        assertThat(aiProvider.refinementCalls()).isEqualTo(2);
        assertThat(service.refinement(loop.runId()).getSuggestedContent())
            .isEqualTo(regenerated.getSuggestedContent());
        assertThat(aiProvider.refinementCalls()).isEqualTo(2);
    }

    @Test
    void pendingRefinementClaimIsReloadedWithoutAnotherProviderCall() {
        CompletedLoop loop = completeLoop();
        service.complete(loop.runId(), null);

        jdbc.update(
            """
            UPDATE discussion_run_refinements
            SET status='PENDING', suggestion_content=NULL,
                generation_metadata_json=NULL, generated_at=NULL
            WHERE run_id=? AND generation_locale='en'
            """,
            loop.runId()
        );

        var pending = service.refinement(loop.runId());
        assertThat(pending.getSuggestionStatus()).isEqualTo("PENDING");
        assertThat(pending.getSuggestedContent()).isNull();
        assertThat(aiProvider.refinementCalls()).isEqualTo(1);
    }

    @Test
    void enforcesThreeFiveSevenInterviewBoundaries() {
        var reflection = service.createReflection(100L, SaveReflectionRequest.builder()
            .content("침묵을 회피와 보호의 긴장으로 읽은 첫 생각이다.")
            .visibility("PRIVATE")
            .build());
        var interview = service.startInterview(reflection.getReflectionId());
        assertThat(interview.getMinimumAnswers()).isEqualTo(3);
        assertThat(interview.getTargetAnswers()).isEqualTo(5);
        assertThat(interview.getMaximumQuestions()).isEqualTo(7);
        for (int answerIndex = 1; answerIndex <= 3; answerIndex++) {
            interview = service.respond(
                interview.getInterviewId(),
                InterviewResponseRequest.builder()
                    .questionId(interview.getCurrentQuestion().getQuestionId())
                    .mode("ANSWER")
                    .content("답변 " + answerIndex + ": 본문 근거와 다른 가능성을 함께 본다.")
                    .build()
            );
        }

        assertThat(interview.getGeneratedCount()).isEqualTo(3);
        assertThat(interview.getCurrentQuestion()).isNull();
        assertThat(interview.isCanGenerateGuide()).isTrue();

        var continued = service.continueInterview(interview.getInterviewId());
        assertThat(continued.getGeneratedCount()).isEqualTo(4);
        assertThat(continued.getCurrentQuestion()).isNotNull();
        Long answerSourceId = jdbc.queryForObject(
            """
            SELECT source_ref_id
            FROM questions
            WHERE id=?
            """,
            Long.class,
            continued.getCurrentQuestion().getQuestionId()
        );
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM session_insights
            WHERE id=? AND insight_type='question_answer' AND visibility='PRIVATE'
            """,
            Integer.class,
            answerSourceId
        )).isEqualTo(1);

        interview = continued;
        for (int answerIndex = 4; answerIndex <= 5; answerIndex++) {
            interview = service.respond(
                interview.getInterviewId(),
                InterviewResponseRequest.builder()
                    .questionId(interview.getCurrentQuestion().getQuestionId())
                    .mode("ANSWER")
                    .content("답변 " + answerIndex + ": 목표 답변 경계까지 다른 관점을 검토한다.")
                    .build()
            );
        }

        assertThat(interview.getAnsweredCount()).isEqualTo(5);
        assertThat(interview.getGeneratedCount()).isEqualTo(5);
        assertThat(interview.getCurrentQuestion()).isNull();
        assertThat(interview.isCanGenerateGuide()).isTrue();
        assertThat(interview.isMaxReached()).isFalse();

        interview = service.continueInterview(interview.getInterviewId());
        for (int answerIndex = 6; answerIndex <= 7; answerIndex++) {
            interview = service.respond(
                interview.getInterviewId(),
                InterviewResponseRequest.builder()
                    .questionId(interview.getCurrentQuestion().getQuestionId())
                    .mode("ANSWER")
                    .content("답변 " + answerIndex + ": 최대 질문 경계를 넘지 않는지 확인한다.")
                    .build()
            );
        }

        assertThat(interview.getAnsweredCount()).isEqualTo(7);
        assertThat(interview.getGeneratedCount()).isEqualTo(7);
        assertThat(interview.getCurrentQuestion()).isNull();
        assertThat(interview.isMaxReached()).isTrue();
        Long completedInterviewId = interview.getInterviewId();
        assertThatThrownBy(() -> service.continueInterview(completedInterviewId))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).getCode())
                .isEqualTo(ApiErrorCode.COMMON_CONFLICT));
    }

    @Test
    void keepsWordingRevisionInPlaceAndForksRestartWithoutErasingGuideOrRun() {
        PreparedInterview prepared = createEligibleInterview();
        var initial = service.interview(prepared.interviewId());
        var firstAnswer = initial.getAnswers().get(0);

        var wordingOnly = service.updateAnswer(
            initial.getInterviewId(),
            firstAnswer.getQuestionId(),
            com.margins.reflectionloop.model.dto.request.UpdateInterviewAnswerRequest.builder()
                .expectedAnswerVersion(firstAnswer.getVersion().longValue())
                .content("표현만 다듬은 답변")
                .revisionKind("WORDING_ONLY")
                .build()
        );
        assertThat(wordingOnly.getInterviewId()).isEqualTo(initial.getInterviewId());
        assertThat(wordingOnly.getAnswers())
            .filteredOn(answer -> answer.getQuestionId().equals(firstAnswer.getQuestionId()))
            .singleElement()
            .satisfies(answer -> {
                assertThat(answer.getContent()).isEqualTo("표현만 다듬은 답변");
                assertThat(answer.getVersion()).isEqualTo(2);
            });
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM reflection_interview_answer_revisions WHERE interview_id=? AND question_id=?",
            Integer.class,
            initial.getInterviewId(),
            firstAnswer.getQuestionId()
        )).isEqualTo(2);

        DiscussionGuideResponse guide = service.createGuide(
            initial.getInterviewId(),
            guideBrief("PRIVATE_CONTEXT")
        );
        var run = service.createRun(guide.getGuideId());

        var forked = service.updateAnswer(
            initial.getInterviewId(),
            firstAnswer.getQuestionId(),
            com.margins.reflectionloop.model.dto.request.UpdateInterviewAnswerRequest.builder()
                .expectedAnswerVersion(2L)
                .content("여기서부터는 보호와 회피를 함께 다시 생각한다.")
                .revisionKind("RESTART_FROM_HERE")
                .build()
        );

        assertThat(forked.getInterviewId()).isNotEqualTo(initial.getInterviewId());
        assertThat(forked.getParentInterviewId()).isEqualTo(initial.getInterviewId());
        assertThat(forked.getForkQuestionId()).isEqualTo(firstAnswer.getQuestionId());
        assertThat(forked.getGuideId()).isNull();
        assertThat(forked.getAnsweredCount()).isEqualTo(1);
        assertThat(forked.getAnswers())
            .singleElement()
            .satisfies(answer -> {
                assertThat(answer.getContent()).isEqualTo("여기서부터는 보호와 회피를 함께 다시 생각한다.");
                assertThat(answer.getVersion()).isEqualTo(1);
            });
        assertThat(service.interview(initial.getInterviewId()).getStatus()).isEqualTo("ABANDONED");
        assertThat(service.guide(guide.getGuideId()).getGuideId()).isEqualTo(guide.getGuideId());
        assertThat(service.run(run.getRunId()).getGuideId()).isEqualTo(guide.getGuideId());
        assertThatThrownBy(() -> service.regenerateGuide(
            guide.getGuideId(),
            RegenerateDiscussionGuideRequest.builder()
                .expectedVersion(1)
                .brief(guideBrief("PRIVATE_CONTEXT"))
                .build()
        )).isInstanceOfSatisfying(ApiException.class, exception ->
            assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_CONFLICT));
        assertThat(service.reflection(prepared.reflectionId()).getActiveInterviewId())
            .isEqualTo(forked.getInterviewId());
        assertThat(jdbc.queryForObject(
            "SELECT revision_kind FROM reflection_interview_answer_revisions WHERE interview_id=? AND is_current=TRUE",
            String.class,
            forked.getInterviewId()
        )).isEqualTo("RESTART_FROM_HERE");
    }

    @Test
    void boundsSameSessionEvidenceAndSnapshotsBookKnowledgeFreshness() {
        for (int index = 1; index <= 4; index++) {
            jdbc.update("""
                INSERT INTO session_highlights (
                  session_id, book_id, user_id, quote_text, note,
                  highlight_order, is_test_data
                ) VALUES (100, 100, 1, ?, ?, ?, TRUE)
                """,
                "하이라이트 " + index + " " + "가".repeat(600),
                "메모 " + index,
                index
            );
        }
        jdbc.update("""
            INSERT INTO book_knowledge (
              title_normalized, author_normalized, lookup_key_type, lookup_key,
              title, author, summary, themes_json, discussion_points_json,
              recommended_personas_json, famous_quotes_json, keywords_json,
              prompt_version, generation_locale, status, fallback_used, is_test_data, generated_at
            ) VALUES (
              'integration reflection book', 'test author',
              'title_author', 'integration reflection book|test author',
              'Integration Reflection Book', 'Test Author', ?,
              JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT(
                'id', 'point-1', 'question', '질문', 'rationale', '근거',
                'recommendedPersonaKeys', JSON_ARRAY()
              )),
              JSON_ARRAY(), JSON_ARRAY(), JSON_ARRAY(),
              'book-knowledge-v1', 'en', 'ready', TRUE, TRUE,
              CURRENT_TIMESTAMP - INTERVAL 45 DAY
            )
            """,
            "Book Knowledge 요약 " + "나".repeat(600)
        );

        var reflection = service.createReflection(100L, SaveReflectionRequest.builder()
            .content("같은 세션 근거의 범위와 immutable snapshot을 검증하는 Reflection이다.")
            .visibility("PRIVATE")
            .build());
        var interview = service.startInterview(reflection.getReflectionId());
        for (int answerIndex = 1; answerIndex <= 3; answerIndex++) {
            interview = service.respond(
                interview.getInterviewId(),
                InterviewResponseRequest.builder()
                    .questionId(interview.getCurrentQuestion().getQuestionId())
                    .mode("ANSWER")
                    .content("bounded 답변 " + answerIndex)
                    .build()
            );
        }
        interview = service.continueInterview(interview.getInterviewId());
        interview = service.respond(
            interview.getInterviewId(),
            InterviewResponseRequest.builder()
                .questionId(interview.getCurrentQuestion().getQuestionId())
                .mode("ANSWER")
                .content("bounded 답변 4")
                .build()
        );

        assertThat(interview.getCurrentQuestion().getCoverageArea()).isEqualTo("SOCIAL_VALUE");
        assertThat(interview.getCurrentQuestion().getSourceType()).isEqualTo("BOOK_KNOWLEDGE");
        assertThat(interview.getCurrentQuestion().getSourceVersion())
            .isEqualTo("book-knowledge-v1");
        assertThat(interview.getCurrentQuestion().isSourceStale()).isTrue();
        assertThat(interview.getCurrentQuestion().isSourceFallback()).isTrue();

        DiscussionGuideResponse guide = service.createGuide(
            interview.getInterviewId(),
            guideBrief("PRIVATE_CONTEXT")
        );
        assertThat(aiProvider.lastGuideRequest().evidence())
            .extracting(evidence -> evidence.alias())
            .containsExactly("R1", "A1", "A2", "A3", "A4", "H1", "H2", "H3", "BK1")
            .doesNotContain("H4");
        assertThat(aiProvider.lastGuideRequest().evidence())
            .allSatisfy(evidence -> assertThat(evidence.excerpt().length())
                .isLessThanOrEqualTo(500));
        assertThat(guide.getItems())
            .filteredOn(item -> "BOOK_KNOWLEDGE".equals(item.getSourceType()))
            .singleElement()
            .satisfies(item -> {
                assertThat(item.getSourceVersion()).isEqualTo("book-knowledge-v1");
                assertThat(item.isSourceStale()).isTrue();
                assertThat(item.isSourceFallback()).isTrue();
            });
        assertThat(service.guideProjection(guide.getGuideId(), "PARTICIPANT"))
            .isInstanceOf(ParticipantDiscussionGuideProjectionResponse.class);
    }

    @Test
    void persistsGuideBriefAndNeverReturnsRawPrivateAnswerExcerpt() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        DiscussionGuideResponse guide = prepared.guide();

        assertThat(guide.getPurpose()).isEqualTo("THOUGHT_EXPANSION");
        assertThat(guide.getAudienceMode()).isEqualTo("SELF_AI");
        assertThat(guide.getTargetMinutes()).isEqualTo(40);
        assertThat(guide.getDisclosureMode()).isEqualTo("PRIVATE_CONTEXT");
        assertThat(guide.getGuideVersion()).isEqualTo(1);
        assertThat(guide.getOrigin()).isEqualTo("GENERATED");
        assertThat(guide.isCurrent()).isTrue();
        assertThat(guide.getCurrentGuideId()).isEqualTo(guide.getGuideId());
        assertThat(guide.getItems().stream()
            .mapToInt(item -> item.getExpectedMinutes())
            .sum()).isEqualTo(40);
        assertThat(guide.getItems())
            .filteredOn(item -> "ANSWER".equals(item.getSourceType()))
            .isNotEmpty()
            .allSatisfy(item -> {
                assertThat(item.isPrivateSource()).isTrue();
                assertThat(item.getSourceExcerpt()).isNull();
            });
        assertThat(guide.getIssues()).noneMatch(issue -> issue.contains("답변 1:"));
        assertThat(guide.getItems()).allMatch(item -> !item.getQuestion().contains("답변 1:"));
        assertThat(aiProvider.lastGuideRequest().purpose()).isEqualTo("THOUGHT_EXPANSION");
        assertThat(aiProvider.lastGuideRequest().targetMinutes()).isEqualTo(40);
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM discussion_guide_items
            WHERE guide_id=? AND source_type='ANSWER' AND source_excerpt LIKE '답변 %'
            """,
            Integer.class,
            guide.getGuideId()
        )).isGreaterThan(0);
    }

    @Test
    void guideFailureWritesNoAggregateAndExplicitRetryCreatesOneSafeVersion() {
        PreparedInterview prepared = createEligibleInterview();
        int questionCountBeforeGuide = jdbc.queryForObject(
            "SELECT COUNT(*) FROM questions",
            Integer.class
        );
        aiProvider.failNextGuide();

        assertThatThrownBy(() -> service.createGuide(
            prepared.interviewId(),
            guideBrief("PRIVATE_CONTEXT")
        )).isInstanceOfSatisfying(ApiException.class, exception ->
            assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_UPSTREAM_ERROR)
        );

        assertThat(aiProvider.guideCalls()).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_guides WHERE interview_id=?",
            Integer.class,
            prepared.interviewId()
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_guide_items",
            Integer.class
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM questions",
            Integer.class
        )).isEqualTo(questionCountBeforeGuide);
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM ai_generation_events
            WHERE task_type='DISCUSSION_GUIDE'
              AND outcome='FAILURE'
              AND failure_category='UNCLASSIFIED'
            """,
            Integer.class
        )).isEqualTo(1);

        aiProvider.makeNextExperienceUnskippable();
        DiscussionGuideResponse guide = service.createGuide(
            prepared.interviewId(),
            guideBrief("PRIVATE_CONTEXT")
        );

        assertThat(aiProvider.guideCalls()).isEqualTo(2);
        assertThat(guide.getGuideVersion()).isEqualTo(1);
        assertThat(guide.isCurrent()).isTrue();
        assertThat(guide.getItems())
            .filteredOn(item -> "EXPERIENCE".equals(item.getStage()))
            .singleElement()
            .satisfies(item -> assertThat(item.isSkippable()).isTrue());
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM discussion_guides
            WHERE interview_id=? AND guide_version=1 AND is_current=TRUE
            """,
            Integer.class,
            prepared.interviewId()
        )).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM discussion_guide_items
            WHERE guide_id=? AND stage='EXPERIENCE' AND skippable=TRUE
            """,
            Integer.class,
            guide.getGuideId()
        )).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM questions",
            Integer.class
        )).isEqualTo(questionCountBeforeGuide + 5);
    }

    @Test
    void persistsAnExactMinuteTotalForEverySupportedGuideTarget() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT", 20));
        DiscussionGuideResponse guide = prepared.guide();
        assertPersistedMinuteTotal(guide, 20);

        for (int targetMinutes : List.of(40, 60)) {
            guide = service.regenerateGuide(
                guide.getGuideId(),
                RegenerateDiscussionGuideRequest.builder()
                    .expectedVersion(guide.getGuideVersion())
                    .brief(guideBrief("PRIVATE_CONTEXT", targetMinutes))
                    .build()
            );
            assertPersistedMinuteTotal(guide, targetMinutes);
        }
    }

    @Test
    void editAndRegenerateCreateImmutableVersionsWhileRunStaysPinned() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        DiscussionGuideResponse first = prepared.guide();
        var run = service.createRun(first.getGuideId());
        service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("원래 발제안에 연결된 active run을 보존한다.")
            .navigation("RESPOND")
            .build());
        assertThat(service.run(run.getRunId()).getStatus()).isEqualTo("ACTIVE");

        EditDiscussionGuideRequest edit = editRequest(first, "편집한 발제 목표");
        DiscussionGuideResponse second = service.editGuide(first.getGuideId(), edit);

        assertThat(second.getGuideVersion()).isEqualTo(2);
        assertThat(second.getSourceGuideId()).isEqualTo(first.getGuideId());
        assertThat(second.getOrigin()).isEqualTo("USER_EDIT");
        assertThat(second.isCurrent()).isTrue();
        assertThat(second.getGoal()).isEqualTo("편집한 발제 목표");
        assertThat(second.getItems().get(0).getQuestion()).startsWith("[편집]");
        assertThat(service.guide(first.getGuideId()).isCurrent()).isFalse();
        assertThat(service.guide(first.getGuideId()).getStatus()).isEqualTo("ARCHIVED");
        assertThat(service.guide(first.getGuideId()).getItems().get(0).getQuestion())
            .doesNotStartWith("[편집]");
        assertThat(service.guide(first.getGuideId()).getItems())
            .filteredOn(item -> "ANSWER".equals(item.getSourceType()))
            .allSatisfy(item -> {
                assertThat(item.isPrivateSource()).isTrue();
                assertThat(item.getSourceExcerpt()).isNull();
            });
        assertThat(service.createRun(first.getGuideId()).getRunId()).isEqualTo(run.getRunId());
        assertThat(service.run(run.getRunId()).getGuideId()).isEqualTo(first.getGuideId());

        assertThatThrownBy(() -> service.editGuide(first.getGuideId(), edit))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_CONFLICT)
            );

        DiscussionGuideResponse third = service.regenerateGuide(
            second.getGuideId(),
            RegenerateDiscussionGuideRequest.builder()
                .expectedVersion(2)
                .brief(guideBrief("REFLECTION_ONLY"))
                .build()
        );
        assertThat(third.getGuideVersion()).isEqualTo(3);
        assertThat(third.getSourceGuideId()).isEqualTo(second.getGuideId());
        assertThat(third.getOrigin()).isEqualTo("REGENERATED");
        assertThat(third.getDisclosureMode()).isEqualTo("REFLECTION_ONLY");
        assertThat(aiProvider.lastGuideRequest().evidence())
            .noneMatch(evidence -> "ANSWER".equals(evidence.type()));

        var versions = service.guideVersions(prepared.interviewId());
        assertThat(versions.getCurrentGuideId()).isEqualTo(third.getGuideId());
        assertThat(versions.getVersions())
            .extracting(version -> version.getGuideVersion())
            .containsExactly(3, 2, 1);
        assertThat(versions.getVersions())
            .filteredOn(version -> version.isCurrent())
            .singleElement()
            .extracting(version -> version.getGuideId())
            .isEqualTo(third.getGuideId());
        assertThatThrownBy(() -> service.createRun(second.getGuideId()))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_CONFLICT)
            );
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_guides WHERE interview_id=? AND is_current=TRUE",
            Integer.class,
            prepared.interviewId()
        )).isEqualTo(1);

        Instant now = Instant.parse("2026-08-01T01:00:00Z");
        jdbc.update("""
            UPDATE users
            SET account_status='RESIGNED',
                personal_data_purge_scheduled_at=?,
                erase_activity_on_purge=TRUE
            WHERE id=1
            """, java.sql.Timestamp.from(now.minusSeconds(60)));
        accountLifecycleService.purgeOne(1L, now);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_guides WHERE user_id=1",
            Integer.class
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM discussion_runs WHERE user_id=1",
            Integer.class
        )).isZero();
        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM discussion_guide_items dgi
            INNER JOIN questions q ON q.id=dgi.question_id
            WHERE q.user_id=1
            """,
            Integer.class
        )).isZero();
    }

    @Test
    void projectsAndExportsTheExactArchivedGuideWithoutPrivateAnswerOrAiCalls() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        DiscussionGuideResponse first = prepared.guide();
        String firstGoal = first.getGoal();
        String firstQuestion = first.getItems().get(0).getQuestion();
        DiscussionGuideResponse current = service.editGuide(
            first.getGuideId(),
            editRequest(first, "current v2에만 있는 발제 목표")
        );
        int providerCallsBeforeProjection = aiProvider.guideCalls();

        var facilitator = (FacilitatorDiscussionGuideProjectionResponse)
            service.guideProjection(first.getGuideId(), "FACILITATOR");
        var participant = (ParticipantDiscussionGuideProjectionResponse)
            service.guideProjection(first.getGuideId(), "PARTICIPANT");
        var facilitatorMarkdown = service.guideMarkdown(first.getGuideId(), "FACILITATOR");
        var participantMarkdown = service.guideMarkdown(first.getGuideId(), "PARTICIPANT");

        assertThat(facilitator.getGuideVersion()).isEqualTo(1);
        assertThat(facilitator.isCurrent()).isFalse();
        assertThat(facilitator.getBookTitle()).isEqualTo("Integration Reflection Book");
        assertThat(facilitator.getItems())
            .filteredOn(item -> "ANSWER".equals(item.getSourceType()))
            .isNotEmpty()
            .allSatisfy(item -> {
                assertThat(item.isPrivateSource()).isTrue();
                assertThat(item.getSourceExcerpt()).isNull();
                assertThat(item.getSourceLabel()).isEqualTo("비공개 인터뷰 답변");
            });
        assertThat(participant.getGuideVersion()).isEqualTo(1);
        assertThat(participant.getItems())
            .extracting(item -> item.getQuestion())
            .containsExactlyElementsOf(first.getItems().stream()
                .map(item -> item.getQuestion())
                .toList());
        assertThat(facilitatorMarkdown.getFilename())
            .isEqualTo("integration-reflection-book-v1-facilitator.md");
        assertThat(facilitatorMarkdown.getContent())
            .contains(firstGoal, firstQuestion, "비공개 인터뷰 답변")
            .doesNotContain("답변 1:", current.getGoal());
        assertThat(participantMarkdown.getFilename())
            .isEqualTo("integration-reflection-book-v1-participant.md");
        assertThat(participantMarkdown.getContent())
            .contains(firstGoal, firstQuestion)
            .doesNotContain(
                "답변 1:",
                current.getGoal(),
                "진행 의도",
                "후속 질문",
                "민감도",
                "예상 시간"
            );
        assertThat(aiProvider.guideCalls()).isEqualTo(providerCallsBeforeProjection);

        TestSecurityContextSupport.loginAs(999L, "other-reader");
        try {
            assertThatThrownBy(() -> service.guideMarkdown(first.getGuideId(), "PARTICIPANT"))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_NOT_FOUND)
                );
        } finally {
            TestSecurityContextSupport.loginAs(1L, "peacepiece");
        }
    }

    @Test
    void reflectionProjectionRecoversPinnedRunAcrossCurrentGuideChanges() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        DiscussionGuideResponse first = prepared.guide();
        var run = service.createRun(first.getGuideId());
        service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("이전 version에서 시작한 토론을 진행 중 상태로 만든다.")
            .navigation("RESPOND")
            .build());
        DiscussionGuideResponse current = service.editGuide(
            first.getGuideId(),
            editRequest(first, "새 current 발제 목표")
        );

        var activeProjection = service.reflection(prepared.reflectionId());
        assertThat(activeProjection.getGuideId()).isEqualTo(current.getGuideId());
        assertThat(activeProjection.getRunId()).isEqualTo(run.getRunId());
        assertThat(activeProjection.getRunStatus()).isEqualTo("ACTIVE");

        service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content("이전 version의 토론을 완료하고 다듬기로 복원한다.")
            .navigation("FINISH")
            .build());
        var completedProjection = service.reflection(prepared.reflectionId());
        assertThat(completedProjection.getGuideId()).isEqualTo(current.getGuideId());
        assertThat(completedProjection.getRunId()).isEqualTo(run.getRunId());
        assertThat(completedProjection.getRunStatus()).isEqualTo("COMPLETED");
        assertThat(service.run(run.getRunId()).getGuideId()).isEqualTo(first.getGuideId());
    }

    @Test
    void concurrentRegeneratePersistsExactlyOneNextCurrentVersion() throws Exception {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        DiscussionGuideResponse first = prepared.guide();
        RegenerateDiscussionGuideRequest request = RegenerateDiscussionGuideRequest.builder()
            .expectedVersion(1)
            .brief(guideBrief("PRIVATE_CONTEXT"))
            .build();
        int providerCallsBeforeRegenerate = aiProvider.guideCalls();
        aiProvider.blockNextTwoGuideCalls();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<Object> left = regenerateAsync(executor, first.getGuideId(), request);
            CompletableFuture<Object> right = regenerateAsync(executor, first.getGuideId(), request);
            List<Object> results = List.of(
                left.get(20, TimeUnit.SECONDS),
                right.get(20, TimeUnit.SECONDS)
            );

            assertThat(results).filteredOn(DiscussionGuideResponse.class::isInstance).hasSize(1);
            assertThat(results)
                .filteredOn(ApiException.class::isInstance)
                .singleElement()
                .satisfies(result ->
                    assertThat(((ApiException) result).getCode())
                        .isEqualTo(ApiErrorCode.COMMON_CONFLICT)
                );
            assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM discussion_guides WHERE interview_id=?",
                Integer.class,
                prepared.interviewId()
            )).isEqualTo(2);
            assertThat(jdbc.queryForObject(
                "SELECT MAX(guide_version) FROM discussion_guides WHERE interview_id=?",
                Integer.class,
                prepared.interviewId()
            )).isEqualTo(2);
            assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM discussion_guides WHERE interview_id=? AND is_current=TRUE",
                Integer.class,
                prepared.interviewId()
            )).isEqualTo(1);
            assertThat(aiProvider.guideCalls() - providerCallsBeforeRegenerate)
                .as("Both concurrent requests currently pay one provider call before stale revalidation")
                .isEqualTo(2);
        } finally {
            executor.shutdownNow();
        }
    }

    private CompletedLoop completeLoop() {
        PreparedGuide prepared = createEligibleGuide(guideBrief("PRIVATE_CONTEXT"));
        var guide = prepared.guide();
        assertThat(guide.getDepth()).isEqualTo("SIMPLE");
        assertThat(guide.getItems())
            .hasSize(5)
            .extracting(item -> item.getStage())
            .containsExactly(
                "WARM_UP",
                "INTERPRETATION",
                "EXPERIENCE",
                "SOCIAL_VALUE",
                "CLOSING"
            );
        assertThat(guide.getItems()).allMatch(item -> "REQUIRED".equals(item.getPriority()));
        assertThat(jdbc.queryForObject(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(generation_metadata_json, '$.taskType')) FROM discussion_guides WHERE id=?",
            String.class,
            guide.getGuideId()
        )).isEqualTo("DISCUSSION_GUIDE");

        var run = service.createRun(guide.getGuideId());
        String substantial = "이 장면은 책임을 피하는 행동으로 보이지만 동시에 다른 인물을 보호하려는 망설임도 함께 드러낸다고 생각합니다.";
        var firstTurn = service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .content(substantial)
            .navigation("RESPOND")
            .build());
        assertThat(firstTurn.isPerspectiveSelectionRequired()).isTrue();
        assertThat(firstTurn.getPerspectiveCandidates()).isNotEmpty();
        service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
            .personaId(firstTurn.getPerspectiveCandidates().get(0).getPersonaId())
            .navigation("SELECT_PERSPECTIVE")
            .build());
        for (int step = 0; step < 5; step++) {
            service.turn(run.getRunId(), GuidedDiscussionTurnRequest.builder()
                .content("이 항목에서 확인한 근거를 남기고 다음 주제로 이동합니다. 단계 " + step)
                .navigation("NEXT")
                .build());
        }
        var completedRun = service.run(run.getRunId());
        assertThat(completedRun.getStatus()).isEqualTo("COMPLETED");
        return new CompletedLoop(prepared.reflectionId(), run.getRunId());
    }

    private PreparedGuide createEligibleGuide(GuideBriefRequest brief) {
        PreparedInterview prepared = createEligibleInterview();
        var guide = service.createGuide(prepared.interviewId(), brief);
        return new PreparedGuide(
            prepared.reflectionId(),
            prepared.interviewId(),
            guide
        );
    }

    private PreparedInterview createEligibleInterview() {
        var reflection = service.createReflection(100L, SaveReflectionRequest.builder()
            .content("주인공의 침묵은 회피이면서도 다른 사람을 지키려는 선택처럼 보였다.")
            .visibility("PUBLIC")
            .build());
        assertThat(reflection.getCurrentRevision().getVersion()).isEqualTo(1);

        var interview = service.startInterview(reflection.getReflectionId());
        for (int answerIndex = 1; answerIndex <= 3; answerIndex++) {
            interview = service.respond(
                interview.getInterviewId(),
                InterviewResponseRequest.builder()
                    .questionId(interview.getCurrentQuestion().getQuestionId())
                    .mode("ANSWER")
                    .content("답변 " + answerIndex + ": 본문 장면의 선택과 그 반대 해석을 함께 살펴본다.")
                    .build()
            );
        }
        assertThat(interview.isCanGenerateGuide()).isTrue();
        assertThat(interview.getAnsweredCount()).isEqualTo(3);

        return new PreparedInterview(
            reflection.getReflectionId(),
            interview.getInterviewId()
        );
    }

    private GuideBriefRequest guideBrief(String disclosureMode) {
        return guideBrief(disclosureMode, 40);
    }

    private GuideBriefRequest guideBrief(String disclosureMode, int targetMinutes) {
        return GuideBriefRequest.builder()
            .purpose("THOUGHT_EXPANSION")
            .audienceMode("SELF_AI")
            .targetMinutes(targetMinutes)
            .disclosureMode(disclosureMode)
            .build();
    }

    private void assertPersistedMinuteTotal(
        DiscussionGuideResponse guide,
        int targetMinutes
    ) {
        assertThat(guide.getTargetMinutes()).isEqualTo(targetMinutes);
        assertThat(guide.getItems())
            .allSatisfy(item -> assertThat(item.getExpectedMinutes()).isBetween(1, 20));
        assertThat(guide.getItems().stream()
            .mapToInt(item -> item.getExpectedMinutes())
            .sum()).isEqualTo(targetMinutes);
        assertThat(jdbc.queryForObject(
            """
            SELECT SUM(expected_minutes)
            FROM discussion_guide_items
            WHERE guide_id=?
            """,
            Integer.class,
            guide.getGuideId()
        )).isEqualTo(targetMinutes);
    }

    private EditDiscussionGuideRequest editRequest(
        DiscussionGuideResponse source,
        String goal
    ) {
        return EditDiscussionGuideRequest.builder()
            .expectedVersion(source.getGuideVersion())
            .goal(goal)
            .issues(source.getIssues())
            .items(source.getItems().stream()
                .map(item -> GuideItemEditRequest.builder()
                    .itemId(item.getItemId())
                    .question(item.getOrder() == 1
                        ? "[편집] " + item.getQuestion()
                        : item.getQuestion())
                    .intent(item.getIntent())
                    .expectedMinutes(item.getExpectedMinutes())
                    .followUps(item.getFollowUps())
                    .build())
                .toList())
            .build();
    }

    private CompletableFuture<Object> regenerateAsync(
        ExecutorService executor,
        Long guideId,
        RegenerateDiscussionGuideRequest request
    ) {
        return CompletableFuture.supplyAsync(() -> {
            TestSecurityContextSupport.loginAs(1L, "peacepiece");
            try {
                return service.regenerateGuide(guideId, request);
            } catch (ApiException exception) {
                return exception;
            } finally {
                TestSecurityContextSupport.clear();
            }
        }, executor);
    }

    private record CompletedLoop(Long reflectionId, Long runId) {
    }

    private record PreparedGuide(
        Long reflectionId,
        Long interviewId,
        DiscussionGuideResponse guide
    ) {
    }

    private record PreparedInterview(Long reflectionId, Long interviewId) {
    }

    @TestConfiguration
    static class ProviderConfiguration {
        @Bean
        @Primary
        CountingPlaceholderAiProvider transactionBoundaryAssertingProvider() {
            return new CountingPlaceholderAiProvider();
        }

        @Bean
        @Primary
        ConfigurableDiscussionModerator deterministicModerator() {
            return new ConfigurableDiscussionModerator();
        }
    }

    static class ConfigurableDiscussionModerator implements DiscussionModerator {
        private final AtomicBoolean structure = new AtomicBoolean();

        @Override
        public DiscussionModerationResult moderate(
            com.margins.moderation.DiscussionModerationRequest request
        ) {
            boolean discussionStructure = structure.get();
            return DiscussionModerationResult.builder()
                .decision(discussionStructure ? ModerationDecision.REDIRECT : ModerationDecision.ALLOW)
                .intent(discussionStructure
                    ? ModerationIntent.DISCUSSION_STRUCTURE
                    : ModerationIntent.BOOK_DISCUSSION)
                .relevanceScore(discussionStructure ? 0 : 1)
                .confidence(1)
                .reasonCode(discussionStructure ? "DISCUSSION_STRUCTURE" : "BOOK_RELATED")
                .suggestedQuestion(discussionStructure
                    ? "기본 토론은 Me + Director로 진행하며 필요할 때 다른 관점을 초대할 수 있어요."
                    : "")
                .model("moderator-fixture")
                .latencyMs(1)
                .fallbackUsed(false)
                .build();
        }

        void allow() {
            structure.set(false);
        }

        void discussionStructure() {
            structure.set(true);
        }
    }

    static class CountingPlaceholderAiProvider extends PlaceholderAiProvider {
        private final AtomicInteger refinementCalls = new AtomicInteger();
        private final AtomicInteger guideCalls = new AtomicInteger();
        private final AtomicInteger personaCalls = new AtomicInteger();
        private final AtomicBoolean refinementFailure = new AtomicBoolean();
        private final AtomicBoolean guideFailure = new AtomicBoolean();
        private final AtomicBoolean personaFailure = new AtomicBoolean();
        private final AtomicBoolean personaConfiguredFallback = new AtomicBoolean();
        private final AtomicBoolean unsafeExperience = new AtomicBoolean();
        private final AtomicReference<Request> lastGuideRequest = new AtomicReference<>();
        private final AtomicReference<CyclicBarrier> guideBarrier = new AtomicReference<>();
        private final AtomicReference<CountDownLatch> personaStarted = new AtomicReference<>();
        private final AtomicReference<CountDownLatch> personaRelease = new AtomicReference<>();

        @Override
        public AiGenerationResult<QuestionListResponse> suggestQuestionsWithMetadata(
            Long windowId,
            GenerateQuestionsRequest request,
            AiGenerationTask task
        ) {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive())
                .as("Interview provider call must run outside a DB transaction")
                .isFalse();
            return super.suggestQuestionsWithMetadata(windowId, request, task);
        }

        @Override
        public Response generateDiscussionGuide(Request request) {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive())
                .as("Guide provider call must run outside a DB transaction")
                .isFalse();
            guideCalls.incrementAndGet();
            lastGuideRequest.set(request);
            if (guideFailure.getAndSet(false)) {
                throw new IllegalStateException("Guide provider unavailable");
            }
            CyclicBarrier barrier = guideBarrier.get();
            if (barrier != null) {
                try {
                    barrier.await(10, TimeUnit.SECONDS);
                    guideBarrier.compareAndSet(barrier, null);
                } catch (Exception exception) {
                    throw new IllegalStateException("Guide concurrency barrier failed", exception);
                }
            }
            Response response = super.generateDiscussionGuide(request);
            boolean hasHighlight = request.evidence().stream()
                .anyMatch(evidence -> "H1".equals(evidence.alias()));
            boolean hasBookKnowledge = request.evidence().stream()
                .anyMatch(evidence -> "BK1".equals(evidence.alias()));
            boolean makeExperienceUnskippable = unsafeExperience.getAndSet(false);
            if (!hasHighlight && !hasBookKnowledge && !makeExperienceUnskippable) {
                return response;
            }
            return new Response(
                response.goal(),
                response.issues(),
                response.items().stream()
                    .map(item -> {
                        String alias = item.sourceAlias();
                        if (hasHighlight && "INTERPRETATION".equals(item.stage())) {
                            alias = "H1";
                        }
                        if (hasBookKnowledge && "SOCIAL_VALUE".equals(item.stage())) {
                            alias = "BK1";
                        }
                        return new com.margins.ai.DiscussionGuideGeneration.Item(
                            item.stage(),
                            item.priority(),
                            item.question(),
                            item.intent(),
                            alias,
                            item.sensitivity(),
                            makeExperienceUnskippable && "EXPERIENCE".equals(item.stage())
                                ? false
                                : item.skippable(),
                            item.expectedMinutes(),
                            item.followUps()
                        );
                    })
                    .toList(),
                response.provider(),
                response.model(),
                response.tokenUsage(),
                response.latencyMs(),
                response.outcome(),
                response.fallbackUsed()
            );
        }

        @Override
        public AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
            Long windowId,
            SendMessageRequest request,
            AiGenerationTask task
        ) {
            String content = request.getContent();
            if (content != null && content.contains("[DISCUSSION_DIRECTOR]")) {
                return AiGenerationResult.completed(AiMessageResponse.builder()
                    .windowId(windowId)
                    .role("assistant")
                    .content("{\"action\":\"CALL_PERSPECTIVE\",\"reply\":\"답을 반영했습니다.\",\"focus\":\"현재 쟁점\",\"candidatePersonaIds\":[1]}")
                    .streamingReady(true)
                    .aiModel("placeholder")
                    .build(), task, "placeholder", "placeholder", AiTokenUsage.NONE, 0,
                    "FALLBACK", true);
            }
            if (content != null && content.contains("Compare the current Reflection with the perspective")) {
                assertThat(TransactionSynchronizationManager.isActualTransactionActive())
                    .as("Refinement provider call must run outside a DB transaction")
                    .isFalse();
                refinementCalls.incrementAndGet();
                if (refinementFailure.get()) {
                    throw new IllegalStateException("refinement provider unavailable");
                }
            }
            return super.answerWindowMessageWithMetadata(windowId, request, task);
        }

        @Override
        public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
            Long windowId,
            DebateMessageRequest request,
            AiGenerationTask task
        ) {
            personaCalls.incrementAndGet();
            CountDownLatch started = personaStarted.get();
            if (started != null) {
                started.countDown();
            }
            CountDownLatch release = personaRelease.get();
            if (release != null) {
                try {
                    release.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("persona provider barrier interrupted", exception);
                }
            }
            if (personaFailure.getAndSet(false)) {
                throw new IllegalStateException("persona provider unavailable");
            }
            if (personaConfiguredFallback.getAndSet(false)) {
                AiMessageResponse response = super
                    .answerDebateMessageWithMetadata(windowId, request, task)
                    .value();
                return AiGenerationResult.completed(
                    response,
                    task,
                    "openai",
                    "gpt-test",
                    AiTokenUsage.NONE,
                    1,
                    "FALLBACK",
                    true
                );
            }
            return super.answerDebateMessageWithMetadata(windowId, request, task)
                .withOutcome("SUCCESS", false);
        }

        void failRefinement() {
            refinementFailure.set(true);
        }

        int refinementCalls() {
            return refinementCalls.get();
        }

        int guideCalls() {
            return guideCalls.get();
        }

        int personaCalls() {
            return personaCalls.get();
        }

        void resetRefinement() {
            refinementCalls.set(0);
            guideCalls.set(0);
            personaCalls.set(0);
            refinementFailure.set(false);
            guideFailure.set(false);
            personaFailure.set(false);
            personaConfiguredFallback.set(false);
            unsafeExperience.set(false);
            lastGuideRequest.set(null);
            guideBarrier.set(null);
            personaStarted.set(null);
            personaRelease.set(null);
        }

        Request lastGuideRequest() {
            return lastGuideRequest.get();
        }

        void blockNextTwoGuideCalls() {
            guideBarrier.set(new CyclicBarrier(2));
        }

        void failNextGuide() {
            guideFailure.set(true);
        }

        void failNextPersona() {
            personaFailure.set(true);
        }

        void fallbackNextPersona() {
            personaConfiguredFallback.set(true);
        }

        void blockNextPersonaCall() {
            personaStarted.set(new CountDownLatch(1));
            personaRelease.set(new CountDownLatch(1));
        }

        boolean awaitPersonaStarted() throws InterruptedException {
            CountDownLatch started = personaStarted.get();
            return started != null && started.await(5, TimeUnit.SECONDS);
        }

        void releasePersonaCall() {
            CountDownLatch release = personaRelease.getAndSet(null);
            if (release != null) {
                release.countDown();
            }
        }

        void makeNextExperienceUnskippable() {
            unsafeExperience.set(true);
        }
    }
}
