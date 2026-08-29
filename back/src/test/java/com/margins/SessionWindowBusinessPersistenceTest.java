package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.AiProvider;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.ai.observability.AiTraceContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.business.ModerationBusiness;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.question.dto.CreateQuestionRequest;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.ai.DiscussionDirector.DirectorDecision;
import com.margins.session.business.ReadingSessionBusiness;
import com.margins.session.business.SessionWindowBusiness;
import com.margins.session.business.SessionWindowBusiness.GeneratedAiMessage;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateAllMessageRequest;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.dto.CreateSessionWindowRequest;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.dto.SessionWindowTimelineDto;
import com.margins.session.dto.UpdateSessionWindowTitleRequest;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.mapper.SessionWindowPersonaMapper;
import com.margins.session.model.SessionWindowContext;
import com.margins.session.model.SessionWindowRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class SessionWindowBusinessPersistenceTest {

    @Test
    void createPersistsAndReturnsGeneratedId() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        CreateSessionWindowResponse response = business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L)
            .windowType("question")
            .title("Question")
            .build());

        assertThat(response.getWindowId()).isEqualTo(300L);
        assertThat(response.getSessionId()).isEqualTo(3L);
        assertThat(response.getStatus()).isEqualTo("open");
        assertThat(windowMapper.inserted.getPosition()).isEqualTo(5);
    }

    @Test
    void createPersistsOrderedPersonaSelectionAndReturnsIt() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        FakeSessionWindowPersonaMapper personaMapper = new FakeSessionWindowPersonaMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(), windowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), new FakePersonaMapper()
        );
        business.configureSessionWindowPersonaMapper(personaMapper);

        CreateSessionWindowResponse response = business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("Debate").personaIds(List.of(5L, 4L)).build());

        assertThat(personaMapper.windowId).isEqualTo(300L);
        assertThat(personaMapper.personaIds).containsExactly(5L, 4L);
        assertThat(response.getPersonaIds()).containsExactly(5L, 4L);
    }

    @Test
    void createPersistsOnePersonaAndReturnsEmptySelectionWhenOmitted() {
        FakeSessionWindowMapper selectedWindowMapper = new FakeSessionWindowMapper();
        FakeSessionWindowPersonaMapper selectedPersonaMapper = new FakeSessionWindowPersonaMapper();
        SessionWindowBusiness selectedBusiness = new SessionWindowBusiness(
            new StubAiProvider(), selectedWindowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), new FakePersonaMapper()
        );
        selectedBusiness.configureSessionWindowPersonaMapper(selectedPersonaMapper);

        CreateSessionWindowResponse selected = selectedBusiness.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("One").personaIds(List.of(5L)).build());

        assertThat(selected.getPersonaIds()).containsExactly(5L);
        assertThat(selectedPersonaMapper.personaIds).containsExactly(5L);
        assertThat(selectedPersonaMapper.findPersonaIds(300L)).containsExactly(5L);

        FakeSessionWindowMapper legacyWindowMapper = new FakeSessionWindowMapper();
        FakeSessionWindowPersonaMapper legacyPersonaMapper = new FakeSessionWindowPersonaMapper();
        SessionWindowBusiness legacyBusiness = new SessionWindowBusiness(
            new StubAiProvider(), legacyWindowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), new FakePersonaMapper()
        );
        legacyBusiness.configureSessionWindowPersonaMapper(legacyPersonaMapper);

        CreateSessionWindowResponse legacy = legacyBusiness.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("Legacy").build());

        assertThat(legacy.getPersonaIds()).isEmpty();
        assertThat(legacyPersonaMapper.personaIds).isNull();
    }

    @Test
    void createWithExplicitEmptyPersonaIdsReturnsEmptySelectionWithoutRelationInsert() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        FakeSessionWindowPersonaMapper personaMapper = new FakeSessionWindowPersonaMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(), windowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), new FakePersonaMapper()
        );
        business.configureSessionWindowPersonaMapper(personaMapper);

        CreateSessionWindowResponse response = business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("Empty").personaIds(List.of()).build());

        assertThat(response.getPersonaIds()).isEmpty();
        assertThat(personaMapper.personaIds).isNull();
        assertThat(personaMapper.findPersonaIds(300L)).isEmpty();
    }

    @Test
    void timelineWindowDtoSerializesOrderedPersistedPersonaIdsAndMapperOrdersBySelection() throws Exception {
        FakeSessionWindowPersonaMapper personaMapper = new FakeSessionWindowPersonaMapper();
        personaMapper.insertSelections(300L, List.of(5L, 4L));
        ReadingSessionBusiness business = new ReadingSessionBusiness(
            null, null, null, null, null, null, null, null, null
        );
        business.configureSessionWindowPersonaMapper(personaMapper);

        Method toWindowDto = ReadingSessionBusiness.class.getDeclaredMethod("toWindowDto", SessionWindowRecord.class);
        toWindowDto.setAccessible(true);
        SessionWindowTimelineDto timeline = (SessionWindowTimelineDto) toWindowDto.invoke(
            business,
            SessionWindowRecord.builder().id(300L).sessionId(3L).windowType("debate").title("Debate")
                .position(5).status("open").build()
        );

        assertThat(timeline.getPersonaIds()).containsExactly(5L, 4L);
        assertThat(new ObjectMapper().writeValueAsString(timeline))
            .contains("\"personaIds\":[5,4]");
    }

    @Test
    void createRejectsNullDuplicateAndTooManyPersonasBeforeWindowInsert() {
        List<Long> nullSelection = new ArrayList<>(List.of(4L));
        nullSelection.add(null);
        assertCreateRejectsBadSelection(nullSelection);
        assertCreateRejectsBadSelection(List.of(4L, 4L));
        assertCreateRejectsBadSelection(List.of(4L, 5L, 6L));
    }

    @Test
    void createRejectsInactiveOrMissingPersonaBeforeWindowInsert() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        FakePersonaMapper personaMapper = new FakePersonaMapper();
        personaMapper.inactivePersonaId = 5L;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(), windowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), personaMapper
        );

        assertNotFound("Persona not found", () -> business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("Inactive").personaIds(List.of(5L)).build()));
        assertThat(windowMapper.inserted).isNull();

        assertNotFound("Persona not found", () -> business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("Missing").personaIds(List.of(99L)).build()));
        assertThat(windowMapper.inserted).isNull();
    }

    @Test
    void createRejectsPersonaNotOwnedByCurrentUser() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        FakePersonaMapper personaMapper = new FakePersonaMapper();
        personaMapper.deniedPersonaId = 5L;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(), windowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), personaMapper
        );

        assertNotFound("Persona not found", () -> business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L).windowType("debate").title("Debate").personaIds(List.of(5L)).build()));
        assertThat(windowMapper.inserted).isNull();
    }

    @Test
    void questionDebateWindowIsCreatedOnceAndThenReused() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        QuestionRecord question = QuestionRecord.builder()
            .sessionId(30L)
            .windowId(31L)
            .userId(1L)
            .questionText("How does ritual shape power?")
            .questionType("reflection")
            .status("active")
            .build();
        questionMapper.insert(question);
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            questionMapper,
            new FakePersonaMapper()
        );

        CreateSessionWindowResponse created = business.ensureQuestionDebateWindow(question.getId());
        CreateSessionWindowResponse reused = business.ensureQuestionDebateWindow(question.getId());

        assertThat(created.getWindowId()).isEqualTo(reused.getWindowId());
        assertThat(created.getSourceQuestionId()).isEqualTo(question.getId());
        assertThat(windowMapper.inserted.getWindowType()).isEqualTo("debate");
        assertThat(windowMapper.inserted.getTitle()).isEqualTo("How does ritual shape power?");
    }

    @Test
    void createRejectsMissingReadingSessionBeforeInsert() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        windowMapper.activeSessionCount = 0;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

        assertNotFound("Reading session not found", () -> business.create(CreateSessionWindowRequest.builder()
            .sessionId(404L)
            .windowType("question")
            .title("Missing parent")
            .build()));
        assertThat(windowMapper.inserted).isNull();
    }

    @Test
    void createRejectsZeroRowInsert() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        windowMapper.insertRows = 0;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

        assertServerError("Session window could not be saved", () -> business.create(CreateSessionWindowRequest.builder()
            .sessionId(3L)
            .windowType("question")
            .title("Question")
            .build()));
    }

    @Test
    void updateTitleStoresWindowTitleAndReturnsWindow() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

        CreateSessionWindowResponse response = business.updateTitle(10L, UpdateSessionWindowTitleRequest.builder()
            .title("Ecology thread")
            .build());

        assertThat(windowMapper.updatedWindowId).isEqualTo(10L);
        assertThat(windowMapper.updatedTitle).isEqualTo("Ecology thread");
        assertThat(response.getWindowId()).isEqualTo(10L);
        assertThat(response.getTitle()).isEqualTo("Ecology thread");
    }

    @Test
    void archiveSoftDeletesWindowAndReturnsArchivedWindow() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        windowMapper.activeWindowCount = 2;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

        CreateSessionWindowResponse response = business.archive(10L);

        assertThat(windowMapper.deletedWindowId).isEqualTo(10L);
        assertThat(response.getWindowId()).isEqualTo(10L);
        assertThat(response.getStatus()).isEqualTo("archived");
    }

    @Test
    void archiveRejectsLastActiveWindow() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        windowMapper.activeWindowCount = 1;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

        assertThatThrownBy(() -> business.archive(10L))
            .isInstanceOf(ApiException.class)
            .satisfies((exception) -> {
                ApiException apiException = (ApiException) exception;
                assertThat(apiException.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(apiException.getCode()).isEqualTo(ApiErrorCode.SESSION_LAST_WINDOW_REQUIRED);
            });

        assertThat(windowMapper.deletedWindowId).isNull();
    }

    @Test
    void windowMutationsReturnNotFoundWhenRowsAreMissing() {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        windowMapper.updatedRows = 0;
        windowMapper.deletedRows = 0;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            windowMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

        assertNotFound("Session window not found", () -> business.updateTitle(10L, UpdateSessionWindowTitleRequest.builder()
            .title("Missing")
            .build()));
        assertNotFound("Session window not found", () -> business.archive(10L));
    }


    @Test
    void sendMessagePersistsUserAndAssistantMessages() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        questionMapper.inserted.add(QuestionRecord.builder()
            .id(9L)
            .sessionId(30L)
            .windowId(10L)
            .userId(1L)
            .questionText("What matters?")
            .questionType("reflection")
            .status("active")
            .build());
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            questionMapper,
            new FakePersonaMapper()
        );
        configureLocale(business);

        AiMessageResponse response = business.sendMessage(10L, SendMessageRequest.builder()
            .content("What matters?")
            .questionId(9L)
            .build());

        assertThat(response.getMessageId()).isEqualTo(101L);
        assertThat(messageMapper.inserted).hasSize(2);
        assertThat(messageMapper.inserted.get(0).getRole()).isEqualTo("user");
        assertThat(messageMapper.inserted.get(0).getGenerationLocale()).isNull();
        assertThat(messageMapper.inserted.get(0).getMessageOrder()).isEqualTo(1);
        assertThat(messageMapper.inserted.get(1).getRole()).isEqualTo("assistant");
        assertThat(messageMapper.inserted.get(1).getParentMessageId()).isEqualTo(100L);
        assertThat(messageMapper.inserted.get(1).getQuestionId()).isEqualTo(9L);
        assertThat(messageMapper.inserted.get(1).getGenerationLocale()).isEqualTo("ko");
        assertThat(messageMapper.inserted.get(1).getLanguageValidationOutcome()).isNull();
        assertThat(messageMapper.orderWindowIds).containsExactly(10L, 10L);
    }

    @Test
    void sendMessageIgnoresClientSuppliedUserId() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        business.sendMessage(10L, SendMessageRequest.builder()
            .userId(999L)
            .content("Do not trust client user id")
            .build());

        assertThat(messageMapper.inserted).extracting(MessageRecord::getUserId).containsOnly(1L);
    }

    @Test
    void streamingLanguageFailureKeepsUserAndSessionTraceContext() {
        AiProvider provider = new StubAiProvider() {
            @Override
            public AiGenerationResult<AiMessageResponse> streamWindowMessageWithMetadata(
                Long windowId,
                SendMessageRequest request,
                java.util.function.Consumer<String> deltaConsumer,
                AiGenerationTask task
            ) {
                return AiGenerationResult.completed(
                    AiMessageResponse.builder()
                        .windowId(windowId)
                        .role("assistant")
                        .content("this response is clearly written in english")
                        .aiModel("model")
                        .build(),
                    task,
                    "openai",
                    "model",
                    AiTokenUsage.NONE,
                    1,
                    "SUCCESS",
                    false
                );
            }
        };
        SessionWindowBusiness business = new SessionWindowBusiness(
            provider,
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);
        AtomicReference<AiGenerationResult<?>> observed = new AtomicReference<>();
        AtomicReference<AiTraceContext> observedContext = new AtomicReference<>();
        business.configureGenerationObserver(new AiGenerationObserver() {
            @Override
            public void observe(
                AiGenerationResult<?> result,
                String depth,
                boolean testData
            ) {
                observed.set(result);
            }

            @Override
            public void observe(
                AiGenerationResult<?> result,
                String depth,
                boolean testData,
                AiTraceContext traceContext
            ) {
                observed.set(result);
                observedContext.set(traceContext);
            }
        });

        assertThatThrownBy(() -> business.streamMessage(
            10L,
            SendMessageRequest.builder().content("질문입니다").build(),
            delta -> { }
        ))
            .isInstanceOf(ApiException.class)
            .satisfies(exception -> assertThat(((ApiException) exception).getCode())
                .isEqualTo(ApiErrorCode.STREAM_MESSAGE_FAILED));

        assertThat(observed.get().outcome()).isEqualTo("FAILURE");
        assertThat(observedContext.get()).isEqualTo(new AiTraceContext(1L, 30L));
    }

    @Test
    void sendMessageRejectsZeroRowUserMessageInsertBeforeAiCall() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        messageMapper.insertRows = 0;
        StubAiProvider aiProvider = new StubAiProvider();
        SessionWindowBusiness business = new SessionWindowBusiness(
            aiProvider,
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertServerError("Message could not be saved", () -> business.sendMessage(10L, SendMessageRequest.builder()
            .content("What matters?")
            .build()));
        assertThat(aiProvider.windowAnswerCalls).isZero();
    }

    @Test
    void sendMessageRejectsQuestionFromAnotherWindow() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        questionMapper.inserted.add(QuestionRecord.builder()
            .id(9L)
            .sessionId(30L)
            .windowId(99L)
            .userId(1L)
            .questionText("Wrong window")
            .questionType("reflection")
            .status("active")
            .build());
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            questionMapper,
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertThatThrownBy(() -> business.sendMessage(10L, SendMessageRequest.builder()
                .content("Answer")
                .questionId(9L)
                .build()))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(responseStatusException.getReason()).isEqualTo("Question not found for session window");
            });

        assertThat(messageMapper.inserted).isEmpty();
    }

    @Test
    void debatePersistsPersonaResponse() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        DebateTurnResponse response = business.debate(10L, DebateMessageRequest.builder()
            .personaId(4L)
            .content("Challenge me")
            .build());

        assertThat(response.getMessages()).singleElement().satisfies(message -> {
            assertThat(message.getMessageId()).isEqualTo(101L);
            assertThat(message.getPersonaId()).isEqualTo(4L);
        });
        assertThat(messageMapper.inserted.get(1).getPersonaId()).isEqualTo(4L);
    }

    @Test
    void debateResolvesLocaleOnceAndSharesSnapshotWithModerationPersonaAndRow() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        AtomicReference<GenerationLocale> providerLocale = new AtomicReference<>();
        StubAiProvider provider = new StubAiProvider() {
            @Override
            public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
                Long windowId,
                DebateMessageRequest request,
                AiGenerationTask task
            ) {
                providerLocale.set(task.generationLocale());
                return super.answerDebateMessageWithMetadata(windowId, request, task);
            }
        };
        SessionWindowBusiness business = new SessionWindowBusiness(
            provider,
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        AtomicInteger resolveCalls = new AtomicInteger();
        GenerationLocaleResolver resolver = mock(GenerationLocaleResolver.class);
        when(resolver.resolve(any())).thenAnswer(invocation ->
            resolveCalls.getAndIncrement() == 0 ? GenerationLocale.KO : GenerationLocale.EN
        );
        business.configureGenerationLocale(
            resolver,
            new AiOutputLanguageValidator()
        );
        AtomicReference<GenerationLocale> moderationLocale = new AtomicReference<>();
        ModerationBusiness moderation = mock(ModerationBusiness.class);
        when(moderation.isEnabled()).thenReturn(true);
        doAnswer(invocation -> {
            moderationLocale.set(invocation.getArgument(3));
            return null;
        }).when(moderation).evaluate(any(), any(), any(), any());
        ReflectionTestUtils.setField(business, "moderationBusiness", moderation);

        business.debate(10L, DebateMessageRequest.builder()
            .personaId(4L)
            .content("Challenge this interpretation")
            .build());

        assertThat(resolveCalls).hasValue(1);
        assertThat(moderationLocale).hasValue(GenerationLocale.KO);
        assertThat(providerLocale).hasValue(GenerationLocale.KO);
        assertThat(messageMapper.inserted.get(1).getGenerationLocale()).isEqualTo("ko");
    }

    @Test
    void debateIgnoresClientSuppliedUserId() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        business.debate(10L, DebateMessageRequest.builder()
            .userId(999L)
            .personaId(4L)
            .content("Challenge me")
            .build());

        assertThat(messageMapper.inserted).extracting(MessageRecord::getUserId).containsOnly(1L);
    }

    @Test
    void debateRejectsInactiveOrMissingPersonaBeforePersistingMessages() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertThatThrownBy(() -> business.debate(10L, DebateMessageRequest.builder()
                .personaId(99L)
                .content("Challenge me")
                .build()))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(responseStatusException.getReason()).isEqualTo("Persona not found");
            });

        assertThat(messageMapper.inserted).isEmpty();
    }

    @Test
    void debateAllPersistsOnePromptAndEveryPersonaResponse() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertThat(business.debateAll(10L, DebateAllMessageRequest.builder()
            .content("Compare this interpretation")
            .build()).getMessages()).hasSize(2);

        assertThat(messageMapper.inserted).hasSize(3);
        assertThat(messageMapper.inserted.get(0).getRole()).isEqualTo("user");
        assertThat(messageMapper.inserted.get(1).getParentMessageId()).isEqualTo(100L);
        assertThat(messageMapper.inserted.get(1).getPersonaId()).isEqualTo(4L);
        assertThat(messageMapper.inserted.get(2).getParentMessageId()).isEqualTo(100L);
        assertThat(messageMapper.inserted.get(2).getPersonaId()).isEqualTo(5L);
    }

    @Test
    void debateAllResolvesLocaleOnceAndSharesSnapshotWithModerationPersonaAndRows() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        AtomicReference<GenerationLocale> providerLocale = new AtomicReference<>();
        StubAiProvider provider = new StubAiProvider() {
            @Override
            public AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
                Long windowId,
                List<DebateMessageRequest> requests,
                AiGenerationTask task
            ) {
                providerLocale.set(task.generationLocale());
                return super.answerDebateMessagesWithMetadata(windowId, requests, task);
            }
        };
        SessionWindowBusiness business = new SessionWindowBusiness(
            provider,
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        AtomicInteger resolveCalls = new AtomicInteger();
        GenerationLocaleResolver resolver = mock(GenerationLocaleResolver.class);
        when(resolver.resolve(any())).thenAnswer(invocation ->
            resolveCalls.getAndIncrement() == 0 ? GenerationLocale.KO : GenerationLocale.EN
        );
        business.configureGenerationLocale(
            resolver,
            new AiOutputLanguageValidator()
        );
        AtomicReference<GenerationLocale> moderationLocale = new AtomicReference<>();
        ModerationBusiness moderation = mock(ModerationBusiness.class);
        when(moderation.isEnabled()).thenReturn(true);
        doAnswer(invocation -> {
            moderationLocale.set(invocation.getArgument(3));
            return null;
        }).when(moderation).evaluate(any(), any(), any(), any());
        ReflectionTestUtils.setField(business, "moderationBusiness", moderation);

        business.debateAll(10L, DebateAllMessageRequest.builder()
            .content("Compare these interpretations")
            .build());

        assertThat(resolveCalls).hasValue(1);
        assertThat(moderationLocale).hasValue(GenerationLocale.KO);
        assertThat(providerLocale).hasValue(GenerationLocale.KO);
        assertThat(messageMapper.inserted.subList(1, 3))
            .extracting(MessageRecord::getGenerationLocale)
            .containsOnly("ko");
    }

    @Test
    void debateAllPreservesPerItemValidationAndAggregateLocaleOnMixedBatch() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        AiProvider provider = new StubAiProvider() {
            @Override
            public AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
                Long windowId,
                List<DebateMessageRequest> requests,
                AiGenerationTask task
            ) {
                return AiGenerationResult.completed(
                    List.of(
                        AiMessageResponse.builder().windowId(windowId).personaId(4L)
                            .role("assistant").content("가나다라마바사아").aiModel("model").build(),
                        AiMessageResponse.builder().windowId(windowId).personaId(5L)
                            .role("assistant").content("this response is clearly written in english").aiModel("model").build()
                    ),
                    task,
                    "openai",
                    "model",
                    AiTokenUsage.NONE,
                    1,
                    "SUCCESS",
                    false
                );
            }
        };
        SessionWindowBusiness business = new SessionWindowBusiness(
            provider,
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);
        AtomicReference<AiGenerationResult<?>> observed = new AtomicReference<>();
        business.configureGenerationObserver((generation, depth, testData) -> observed.set(generation));

        business.debateAll(10L, DebateAllMessageRequest.builder()
            .content("Compare this interpretation")
            .build());

        assertThat(messageMapper.inserted.get(1).getGenerationLocale()).isEqualTo("ko");
        assertThat(messageMapper.inserted.get(1).getLanguageValidationOutcome()).isEqualTo("MATCH");
        assertThat(messageMapper.inserted.get(2).getGenerationLocale()).isEqualTo("ko");
        assertThat(messageMapper.inserted.get(2).getLanguageValidationOutcome())
            .isEqualTo("KNOWN_MISMATCH");
        assertThat(messageMapper.inserted.get(2).getContent()).contains("지금 남은 생각");
        assertThat(observed.get().generationLocale()).isEqualTo(GenerationLocale.KO);
        assertThat(observed.get().outcome()).isEqualTo("FALLBACK");
        assertThat(observed.get().languageValidationOutcome())
            .isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH);
    }

    @Test
    void guidedPersistenceUsesGenerationSnapshotWithoutResolverRelabelingOrRevalidation() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        AiProvider provider = new StubAiProvider() {
            @Override
            public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
                Long windowId,
                DebateMessageRequest request,
                AiGenerationTask task
            ) {
                return AiGenerationResult.completed(
                    AiMessageResponse.builder().windowId(windowId).personaId(request.getPersonaId())
                        .role("assistant").content("가나다라마바사아").aiModel("model").build(),
                    task,
                    "openai",
                    "model",
                    AiTokenUsage.NONE,
                    1,
                    "SUCCESS",
                    false
                );
            }
        };
        SessionWindowBusiness business = new SessionWindowBusiness(
            provider,
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        GenerationLocaleResolver resolver = mock(GenerationLocaleResolver.class);
        when(resolver.resolve(any())).thenReturn(GenerationLocale.EN);
        business.configureGenerationLocale(resolver, new AiOutputLanguageValidator());
        AtomicReference<AiGenerationResult<?>> observed = new AtomicReference<>();
        business.configureGenerationObserver((generation, depth, testData) -> observed.set(generation));

        GeneratedAiMessage generated = business.generateGuidedPersonaResponse(
            10L,
            4L,
            "reader answer",
            77L,
            "SIMPLE",
            GenerationLocale.KO
        );

        business.persistGuidedPersonaResponse(
            10L,
            900L,
            4L,
            MessageRecord.builder().id(77L).userId(1L).build(),
            generated
        );
        business.persistGuidedTurnAtomically(
            10L,
            900L,
            "reader answer",
            new DirectorDecision(
                "ASK_FOLLOW_UP",
                null,
                List.of(),
                "Could you clarify?",
                null,
                "Could you clarify?",
                GenerationLocale.EN,
                null
            ),
            null
        );

        assertThat(messageMapper.inserted.get(0).getGenerationLocale()).isEqualTo("ko");
        assertThat(messageMapper.inserted.get(0).getLanguageValidationOutcome()).isEqualTo("MATCH");
        assertThat(observed.get().generationLocale()).isEqualTo(GenerationLocale.KO);
        assertThat(observed.get().outcome()).isEqualTo("SUCCESS");
        assertThat(observed.get().languageValidationOutcome()).isEqualTo(AiLanguageValidationOutcome.MATCH);
        assertThat(messageMapper.inserted.get(2).getContent()).isEqualTo("Could you clarify?");
        assertThat(messageMapper.inserted.get(2).getGenerationLocale()).isEqualTo("en");
        assertThat(messageMapper.inserted.get(2).getLanguageValidationOutcome()).isNull();
        verifyNoInteractions(resolver);
    }

    @Test
    void debateAllPersistsOnlySelectedPersonaResponses() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertThat(business.debateAll(10L, DebateAllMessageRequest.builder()
            .content("Compare this interpretation")
            .personaIds(List.of(5L))
            .build()).getMessages()).hasSize(1);

        assertThat(messageMapper.inserted).hasSize(2);
        assertThat(messageMapper.inserted.get(0).getRole()).isEqualTo("user");
        assertThat(messageMapper.inserted.get(1).getPersonaId()).isEqualTo(5L);
    }

    @Test
    void debateAllRejectsMoreThanTwoPersonasBeforePersistingPrompt() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertThatThrownBy(() -> business.debateAll(10L, DebateAllMessageRequest.builder()
                .content("Compare this interpretation")
                .personaIds(List.of(4L, 5L, 6L))
                .build()))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(exception.getReason()).isEqualTo("At most two personas can reply together");
            });
        assertThat(messageMapper.inserted).isEmpty();
    }

    @Test
    void debateAllIgnoresClientSuppliedUserId() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );
        configureLocale(business);

        business.debateAll(10L, DebateAllMessageRequest.builder()
            .userId(999L)
            .content("Compare this interpretation")
            .build());

        assertThat(messageMapper.inserted).extracting(MessageRecord::getUserId).containsOnly(1L);
    }

    @Test
    void generateQuestionsPersistsAiSuggestions() {
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            questionMapper,
            new FakePersonaMapper()
        );
        configureLocale(business);

        QuestionListResponse response = business.generateQuestions(10L, GenerateQuestionsRequest.builder()
            .count(2)
            .focus("chapter one")
            .build());

        assertThat(response.getQuestions()).hasSize(1);
        assertThat(response.getQuestions().get(0).getQuestionId()).isEqualTo(900L);
        assertThat(questionMapper.inserted.get(0).getSessionId()).isEqualTo(30L);
        assertThat(questionMapper.inserted.get(0).getWindowId()).isEqualTo(10L);
        assertThat(questionMapper.inserted.get(0).getQuestionText()).contains("chapter one");
        assertThat(questionMapper.inserted.get(0).getGenerationLocale()).isEqualTo("ko");
        assertThat(questionMapper.inserted.get(0).getLanguageValidationOutcome()).isNull();
    }

    @Test
    void generateQuestionsRejectsZeroRowQuestionInsert() {
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        questionMapper.insertRows = 0;
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            questionMapper,
            new FakePersonaMapper()
        );
        configureLocale(business);

        assertServerError("Question could not be saved", () -> business.generateQuestions(10L, GenerateQuestionsRequest.builder()
            .count(1)
            .focus("chapter one")
            .build()));
    }

    @Test
    void createQuestionPersistsReaderPrompt() {
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            questionMapper,
            new FakePersonaMapper()
        );

        QuestionListResponse response = business.createQuestion(10L, CreateQuestionRequest.builder()
            .questionText("How does the reader notice power?")
            .build());

        assertThat(response.getQuestions()).singleElement()
            .satisfies((question) -> {
                assertThat(question.getQuestionText()).isEqualTo("How does the reader notice power?");
                assertThat(question.getQuestionType()).isEqualTo("reader");
            });
        assertThat(questionMapper.inserted.get(0).getSessionId()).isEqualTo(30L);
        assertThat(questionMapper.inserted.get(0).getWindowId()).isEqualTo(10L);
    }

    @Test
    void deleteQuestionSoftDeletesUnansweredPrompt() {
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        questionMapper.inserted.add(QuestionRecord.builder()
            .id(900L)
            .sessionId(30L)
            .windowId(10L)
            .userId(1L)
            .questionText("Scratch prompt")
            .questionType("reader")
            .status("active")
            .build());
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            questionMapper,
            new FakePersonaMapper()
        );

        QuestionDto response = business.deleteQuestion(900L);

        assertThat(response.getQuestionId()).isEqualTo(900L);
        assertThat(questionMapper.deletedQuestionId).isEqualTo(900L);
        assertThat(questionMapper.deletedUserId).isEqualTo(1L);
    }

    @Test
    void deleteQuestionReturnsNotFoundWhenDeleteRowIsMissing() {
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        questionMapper.deletedRows = 0;
        questionMapper.inserted.add(QuestionRecord.builder()
            .id(900L)
            .sessionId(30L)
            .windowId(10L)
            .userId(1L)
            .questionText("Scratch prompt")
            .questionType("reader")
            .status("active")
            .build());
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            questionMapper,
            new FakePersonaMapper()
        );

        assertNotFound("Question not found", () -> business.deleteQuestion(900L));
    }

    private void assertCreateRejectsBadSelection(List<Long> personaIds) {
        FakeSessionWindowMapper windowMapper = new FakeSessionWindowMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(), windowMapper, new FakeMessageMapper(), new FakeQuestionMapper(), new FakePersonaMapper()
        );

        assertThatThrownBy(() -> business.create(CreateSessionWindowRequest.builder()
                .sessionId(3L).windowType("debate").title("Invalid").personaIds(personaIds).build()))
            .isInstanceOfSatisfying(ApiException.class, exception -> {
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_BAD_REQUEST);
                assertThat(exception.getReason()).isEqualTo("At most two distinct personas may be selected");
            });
        assertThat(windowMapper.inserted).isNull();
    }

    private void configureLocale(SessionWindowBusiness business) {
        GenerationLocaleResolver resolver = mock(GenerationLocaleResolver.class);
        when(resolver.resolve(any())).thenReturn(GenerationLocale.KO);
        business.configureGenerationLocale(resolver, new AiOutputLanguageValidator());
    }

    private void assertNotFound(String reason, Runnable action) {
        assertThatThrownBy(action::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(responseStatusException.getReason()).isEqualTo(reason);
            });
    }

    private void assertServerError(String reason, Runnable action) {
        assertThatThrownBy(action::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(responseStatusException.getReason()).isEqualTo(reason);
            });
    }

    private static class FakeSessionWindowMapper implements SessionWindowMapper {
        @Override
        public int updateContextSnapshot(Long windowId, String contextSnapshot) {
            return 1;
        }

        @Override
        public int updateConversationSummaryKo(Long windowId, String summaryJson) {
            return 1;
        }

        @Override
        public int updateConversationSummaryEn(Long windowId, String summaryJson) {
            return 1;
        }

        private SessionWindowRecord inserted;
        private Long updatedWindowId;
        private String updatedTitle;
        private Long deletedWindowId;
        private int activeSessionCount = 1;
        private int activeWindowCount = 2;
        private int insertRows = 1;
        private int updatedRows = 1;
        private int deletedRows = 1;

        @Override
        public int insert(SessionWindowRecord record) {
            this.inserted = record;
            record.setId(300L);
            return insertRows;
        }

        @Override
        public SessionWindowRecord findById(Long id) {
            return SessionWindowRecord.builder()
                .id(id)
                .sessionId(30L)
                .userId(1L)
                .windowType("question")
                .title(updatedTitle == null ? "Question" : updatedTitle)
                .position(1)
                .status("open")
                .build();
        }

        @Override
        public SessionWindowContext findContextById(Long id) {
            return new SessionWindowContext(id, 30L, 1L);
        }

        @Override
        public SessionWindowRecord findActiveDebateBySourceQuestion(Long questionId, Long userId) {
            return inserted != null && questionId.equals(inserted.getSourceQuestionId())
                ? inserted
                : null;
        }

        @Override
        public int updateTitle(Long windowId, String title) {
            this.updatedWindowId = windowId;
            this.updatedTitle = title;
            return updatedRows;
        }

        @Override
        public int softDelete(Long windowId) {
            this.deletedWindowId = windowId;
            return deletedRows;
        }

        @Override
        public int countActiveBySessionId(Long sessionId) {
            return activeWindowCount;
        }

        @Override
        public int countActiveSessionById(Long sessionId, Long userId) {
            return activeSessionCount;
        }

        @Override
        public int selectNextPosition(Long sessionId) {
            return 5;
        }

        @Override
        public List<SessionWindowRecord> findBySessionId(Long sessionId) {
            return List.of();
        }
    }

    private static class FakeMessageMapper implements MessageMapper {
        private final List<MessageRecord> inserted = new ArrayList<>();
        private final List<Long> orderWindowIds = new ArrayList<>();
        private int nextId = 100;
        private int nextOrder = 1;
        private int insertRows = 1;

        @Override
        public int insert(MessageRecord record) {
            if (insertRows <= 0) {
                return insertRows;
            }
            record.setId((long) nextId++);
            inserted.add(record);
            return insertRows;
        }

        @Override
        public int selectNextOrder(Long sessionId, Long windowId) {
            orderWindowIds.add(windowId);
            return nextOrder++;
        }

        @Override
        public List<MessageRecord> findBySessionId(Long sessionId) {
            return List.of();
        }

        @Override
        public List<MessageRecord> findRecentByWindowBefore(Long windowId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public List<MessageRecord> findSummaryCandidates(Long windowId, Long afterMessageId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public MessageRecord findEditableById(Long messageId, Long userId) {
            return null;
        }

        @Override
        public int updateContent(Long messageId, Long userId, String content) {
            return 1;
        }

        @Override
        public int invalidateConversationSummary(Long windowId, Long messageId) {
            return 1;
        }

        @Override
        public int softDelete(Long messageId, Long userId) {
            return 1;
        }
    }

    private static class FakeQuestionMapper implements QuestionMapper {
        private final List<QuestionRecord> inserted = new ArrayList<>();
        private long nextId = 900L;
        private Long deletedQuestionId;
        private Long deletedUserId;
        private int insertRows = 1;
        private int deletedRows = 1;

        @Override
        public int insert(QuestionRecord record) {
            if (insertRows <= 0) {
                return insertRows;
            }
            record.setId(nextId++);
            inserted.add(record);
            return insertRows;
        }

        @Override
        public List<QuestionRecord> findBySessionId(Long sessionId) {
            return List.of();
        }

        @Override
        public List<QuestionRecord> findByWindowId(Long windowId) {
            return inserted;
        }

        @Override
        public QuestionRecord findActiveById(Long questionId, Long userId) {
            return inserted.stream()
                .filter((question) -> question.getId().equals(questionId))
                .findFirst()
                .orElse(null);
        }

        @Override
        public int countActiveUserAnswers(Long questionId) {
            return 0;
        }

        @Override
        public int softDelete(Long questionId, Long userId) {
            this.deletedQuestionId = questionId;
            this.deletedUserId = userId;
            return deletedRows;
        }
    }

    private static class FakePersonaMapper implements PersonaMapper {
        private Long deniedPersonaId;
        private Long inactivePersonaId;
        @Override
        public int insert(PersonaRecord record) {
            return 1;
        }

        @Override
        public List<PersonaRecord> findActive() {
            return List.of(
                PersonaRecord.builder().id(4L).displayName("Historian").systemPrompt("Respond as historian").active(true).build(),
                PersonaRecord.builder().id(5L).displayName("Formalist").systemPrompt("Respond as formalist").active(true).build()
            );
        }

        @Override
        public List<PersonaRecord> findActiveForUser(Long userId) {
            return findActive();
        }

        @Override
        public PersonaRecord findActiveById(Long id) {
            return findActive().stream()
                .filter((persona) -> persona.getId().equals(id))
                .findFirst()
                .orElse(null);
        }

        @Override
        public PersonaRecord findActiveByIdForUser(Long id, Long userId) {
            return id.equals(deniedPersonaId) || id.equals(inactivePersonaId) ? null : findActiveById(id);
        }
    }

    private static class FakeSessionWindowPersonaMapper implements SessionWindowPersonaMapper {
        private Long windowId;
        private List<Long> personaIds;

        @Override
        public int insertSelections(Long windowId, List<Long> personaIds) {
            this.windowId = windowId;
            this.personaIds = List.copyOf(personaIds);
            return personaIds.size();
        }

        @Override
        public List<Long> findPersonaIds(Long windowId) {
            return personaIds == null ? List.of() : personaIds;
        }
    }

    private static class StubAiProvider extends com.margins.ai.PlaceholderAiProvider {
        private int windowAnswerCalls;

        @Override
        public AiGenerationResult<QuestionListResponse> suggestQuestionsWithMetadata(
            Long windowId,
            GenerateQuestionsRequest request,
            AiGenerationTask task
        ) {
            QuestionListResponse response = QuestionListResponse.builder()
                .questions(List.of(QuestionDto.builder()
                    .windowId(windowId)
                    .questionText("What matters in " + request.getFocus() + "?")
                    .questionType("reflection")
                    .status("active")
                    .aiModel("placeholder")
                    .build()))
                .build();
            return AiGenerationResult.completed(
                response, task, "placeholder", "placeholder", AiTokenUsage.NONE, 0,
                "FALLBACK", true
            );
        }

        @Override
        public AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
            Long windowId,
            SendMessageRequest request,
            AiGenerationTask task
        ) {
            windowAnswerCalls++;
            AiMessageResponse response = AiMessageResponse.builder()
                .messageId(null)
                .windowId(windowId)
                .role("assistant")
                .content("Answer")
                .streamingReady(true)
                .aiModel("placeholder")
                .build();
            return AiGenerationResult.completed(
                response, task, "placeholder", "placeholder", AiTokenUsage.NONE, 0,
                "FALLBACK", true
            );
        }

        @Override
        public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
            Long windowId,
            DebateMessageRequest request,
            AiGenerationTask task
        ) {
            AiMessageResponse response = AiMessageResponse.builder()
                .messageId(null)
                .windowId(windowId)
                .personaId(request.getPersonaId())
                .role("assistant")
                .content("Debate")
                .streamingReady(true)
                .aiModel("placeholder")
                .build();
            return AiGenerationResult.completed(
                response, task, "placeholder", "placeholder", AiTokenUsage.NONE, 0,
                "FALLBACK", true
            );
        }
    }
}
