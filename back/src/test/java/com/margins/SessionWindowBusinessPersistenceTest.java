package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.margins.testsupport.TestSecurityContextSupport;

import com.margins.ai.AiProvider;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.message.mapper.MessageMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.message.model.MessageRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.persona.model.PersonaRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.dto.CreateQuestionRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.dto.QuestionDto;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.dto.QuestionListResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.mapper.QuestionMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.model.QuestionRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.business.SessionWindowBusiness;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.AiMessageResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateSessionWindowRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.DebateAllMessageRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.SendMessageRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.UpdateSessionWindowTitleRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.mapper.SessionWindowPersonaMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionWindowContext;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionWindowRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.ArrayList;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.http.HttpStatus;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.web.server.ResponseStatusException;
import com.margins.testsupport.TestSecurityContextSupport;

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

        AiMessageResponse response = business.sendMessage(10L, SendMessageRequest.builder()
            .content("What matters?")
            .questionId(9L)
            .build());

        assertThat(response.getMessageId()).isEqualTo(101L);
        assertThat(messageMapper.inserted).hasSize(2);
        assertThat(messageMapper.inserted.get(0).getRole()).isEqualTo("user");
        assertThat(messageMapper.inserted.get(0).getMessageOrder()).isEqualTo(1);
        assertThat(messageMapper.inserted.get(1).getRole()).isEqualTo("assistant");
        assertThat(messageMapper.inserted.get(1).getParentMessageId()).isEqualTo(100L);
        assertThat(messageMapper.inserted.get(1).getQuestionId()).isEqualTo(9L);
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

        business.sendMessage(10L, SendMessageRequest.builder()
            .userId(999L)
            .content("Do not trust client user id")
            .build());

        assertThat(messageMapper.inserted).extracting(MessageRecord::getUserId).containsOnly(1L);
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
    void debateIgnoresClientSuppliedUserId() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

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
    void debateAllPersistsOnlySelectedPersonaResponses() {
        FakeMessageMapper messageMapper = new FakeMessageMapper();
        SessionWindowBusiness business = new SessionWindowBusiness(
            new StubAiProvider(),
            new FakeSessionWindowMapper(),
            messageMapper,
            new FakeQuestionMapper(),
            new FakePersonaMapper()
        );

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

        QuestionListResponse response = business.generateQuestions(10L, GenerateQuestionsRequest.builder()
            .count(2)
            .focus("chapter one")
            .build());

        assertThat(response.getQuestions()).hasSize(1);
        assertThat(response.getQuestions().get(0).getQuestionId()).isEqualTo(900L);
        assertThat(questionMapper.inserted.get(0).getSessionId()).isEqualTo(30L);
        assertThat(questionMapper.inserted.get(0).getWindowId()).isEqualTo(10L);
        assertThat(questionMapper.inserted.get(0).getQuestionText()).contains("chapter one");
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
        public int updateReflectionSummary(Long insightId, String summary, String sourceHash, String model, String tokenUsage) {
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
            return id.equals(deniedPersonaId) ? null : findActiveById(id);
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

    private static class StubAiProvider implements AiProvider {
        private int windowAnswerCalls;

        @Override
        public QuestionListResponse suggestQuestions(Long windowId, GenerateQuestionsRequest request) {
            return QuestionListResponse.builder()
                .questions(List.of(QuestionDto.builder()
                    .windowId(windowId)
                    .questionText("What matters in " + request.getFocus() + "?")
                    .questionType("reflection")
                    .status("active")
                    .aiModel("placeholder")
                    .build()))
                .build();
        }

        @Override
        public AiMessageResponse answerWindowMessage(Long windowId, SendMessageRequest request) {
            windowAnswerCalls++;
            return AiMessageResponse.builder()
                .messageId(null)
                .windowId(windowId)
                .role("assistant")
                .content("Answer")
                .streamingReady(true)
                .aiModel("placeholder")
                .build();
        }

        @Override
        public AiMessageResponse answerDebateMessage(Long windowId, DebateMessageRequest request) {
            return AiMessageResponse.builder()
                .messageId(null)
                .windowId(windowId)
                .personaId(request.getPersonaId())
                .role("assistant")
                .content("Debate")
                .streamingReady(true)
                .aiModel("placeholder")
                .build();
        }
    }
}
