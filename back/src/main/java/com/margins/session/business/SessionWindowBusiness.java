package com.margins.session.business;

import com.margins.auth.support.AuthContext;
import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.ai.observability.AiTraceContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.ModerationDecision;
import com.margins.moderation.business.ModerationBusiness;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.question.dto.CreateQuestionRequest;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.ai.DiscussionDirector.DirectorDecision;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.CreateSessionWindowRequest;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.dto.DebateAllMessageRequest;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.dto.UpdateSessionWindowTitleRequest;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.mapper.SessionWindowPersonaMapper;
import com.margins.session.model.SessionWindowContext;
import com.margins.session.model.SessionWindowRecord;
import java.util.List;
import java.util.ArrayList;
import java.util.Objects;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 세션 윈도우 도메인의 핵심 업무 규칙을 처리한다.
 * 윈도우 생성, 제목 수정, AI 질문/답변, 페르소나 토론 메시지를 조율한다.
 */
@Component
@RequiredArgsConstructor
public class SessionWindowBusiness {

    /** 윈도우/세션 소유권을 검사하기 전에 현재 독자를 확인한다. */
    private long currentUserId() {
        return AuthContext.requireUserId();
    }

    private AiTraceContext traceContext(SessionWindowContext context) {
        return new AiTraceContext(context.getUserId(), context.getSessionId());
    }

    private static final String OPEN_STATUS = "open";
    private static final String ACTIVE_STATUS = "active";
    private static final String READER_QUESTION_TYPE = "reader";
    private static final String COMPLETE_STREAMING_STATUS = "complete";
    private static final int MAX_BATCH_PERSONAS = 2;

    private final AiProvider aiProvider;
    private final SessionWindowMapper sessionWindowMapper;
    private final MessageMapper messageMapper;
    private final QuestionMapper questionMapper;
    private final PersonaMapper personaMapper;
    private GenerationLocaleResolver generationLocaleResolver;
    private AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();
    private SessionWindowPersonaMapper sessionWindowPersonaMapper;
    private ModerationBusiness moderationBusiness;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;

    @Autowired
    void configureModeration(ModerationBusiness moderationBusiness) {
        this.moderationBusiness = moderationBusiness;
    }

    @Autowired
    public void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    @Autowired
    public void configureGenerationLocale(
        GenerationLocaleResolver generationLocaleResolver,
        AiOutputLanguageValidator languageValidator
    ) {
        this.generationLocaleResolver = generationLocaleResolver;
        this.languageValidator = languageValidator;
    }

    @Autowired
    public void configureSessionWindowPersonaMapper(SessionWindowPersonaMapper mapper) {
        this.sessionWindowPersonaMapper = mapper;
    }

    /** 현재 사용자가 소유한 활성 세션 안에 새 윈도우를 만든다. */
    public CreateSessionWindowResponse create(CreateSessionWindowRequest request) {
        if (sessionWindowMapper.countActiveSessionById(request.getSessionId(), currentUserId()) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reading session not found");
        }
        List<Long> personaIds = validatePersonaSelection(request.getPersonaIds());

        SessionWindowRecord record = SessionWindowRecord.builder()
            .sessionId(request.getSessionId())
            .userId(currentUserId())
            .windowType(request.getWindowType())
            .title(request.getTitle())
            .position(sessionWindowMapper.selectNextPosition(request.getSessionId()))
            .status(OPEN_STATUS)
            .testData(true)
            .build();

        requireInserted(sessionWindowMapper.insert(record), "Session window could not be saved");
        if (!personaIds.isEmpty() && sessionWindowPersonaMapper != null) {
            requireInserted(sessionWindowPersonaMapper.insertSelections(record.getId(), personaIds), "Session personas could not be saved");
        }

        return CreateSessionWindowResponse.builder()
            .windowId(record.getId())
            .sessionId(record.getSessionId())
            .sourceQuestionId(record.getSourceQuestionId())
            .windowType(record.getWindowType())
            .title(record.getTitle())
            .status(record.getStatus())
            .personaIds(personaIds)
            .build();
    }

    private List<Long> validatePersonaSelection(List<Long> requestedIds) {
        if (requestedIds == null || requestedIds.isEmpty()) return List.of();
        List<Long> ids = new ArrayList<>(requestedIds);
        if (ids.stream().anyMatch(Objects::isNull) || ids.size() > MAX_BATCH_PERSONAS || ids.size() != ids.stream().distinct().count()) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "At most two distinct personas may be selected");
        }
        ids.forEach((id) -> {
            if (personaMapper.findActiveByIdForUser(id, currentUserId()) == null) {
                throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Persona not found");
            }
        });
        return List.copyOf(ids);
    }

    /** 질문마다 활성 토론방 하나를 재사용하고 없을 때만 새로 만든다. */
    public CreateSessionWindowResponse ensureQuestionDebateWindow(Long questionId) {
        QuestionRecord question = questionMapper.findActiveById(questionId, currentUserId());
        if (question == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Question not found");
        }
        SessionWindowRecord existing = sessionWindowMapper.findActiveDebateBySourceQuestion(
            questionId,
            currentUserId()
        );
        if (existing != null) {
            return toWindowResponse(existing);
        }

        String title = question.getQuestionText().trim();
        if (title.length() > 255) {
            title = title.substring(0, 252) + "...";
        }
        SessionWindowRecord record = SessionWindowRecord.builder()
            .sessionId(question.getSessionId())
            .userId(currentUserId())
            .sourceQuestionId(questionId)
            .windowType("debate")
            .title(title)
            .position(sessionWindowMapper.selectNextPosition(question.getSessionId()))
            .status(OPEN_STATUS)
            .testData(true)
            .build();
        requireInserted(sessionWindowMapper.insert(record), "Debate window could not be saved");
        return toWindowResponse(record);
    }

    /** 접근 가능한 세션에 속하는지 확인한 뒤 윈도우 이름을 바꾼다. */
    public CreateSessionWindowResponse updateTitle(Long windowId, UpdateSessionWindowTitleRequest request) {
        requireWindowContext(windowId);
        requireUpdated(sessionWindowMapper.updateTitle(windowId, request.getTitle()), "Session window not found");
        SessionWindowRecord record = sessionWindowMapper.findById(windowId);

        return CreateSessionWindowResponse.builder()
            .windowId(record.getId())
            .sessionId(record.getSessionId())
            .sourceQuestionId(record.getSourceQuestionId())
            .windowType(record.getWindowType())
            .title(record.getTitle())
            .status(record.getStatus())
            .build();
    }

    /** 각 세션에 활성 윈도우가 하나 이상 남도록 강제하면서 윈도우를 보관 처리한다. */
    public CreateSessionWindowResponse archive(Long windowId) {
        SessionWindowContext context = requireWindowContext(windowId);
        SessionWindowRecord record = sessionWindowMapper.findById(windowId);
        if (sessionWindowMapper.countActiveBySessionId(context.getSessionId()) <= 1) {
            throw new ApiException(ApiErrorCode.SESSION_LAST_WINDOW_REQUIRED);
        }
        requireUpdated(sessionWindowMapper.softDelete(windowId), "Session window not found");

        return CreateSessionWindowResponse.builder()
            .windowId(record.getId())
            .sessionId(record.getSessionId())
            .sourceQuestionId(record.getSourceQuestionId())
            .windowType(record.getWindowType())
            .title(record.getTitle())
            .status("archived")
            .build();
    }

    private CreateSessionWindowResponse toWindowResponse(SessionWindowRecord record) {
        return CreateSessionWindowResponse.builder()
            .windowId(record.getId())
            .sessionId(record.getSessionId())
            .sourceQuestionId(record.getSourceQuestionId())
            .windowType(record.getWindowType())
            .title(record.getTitle())
            .status(record.getStatus())
            .personaIds(sessionWindowPersonaMapper == null ? List.of() : sessionWindowPersonaMapper.findPersonaIds(record.getId()))
            .build();
    }

    /** 사용자 메시지를 저장하고 AI에 한 번 요청한 뒤 사용자 메시지에 연결된 AI 응답을 저장한다. */
    public AiMessageResponse sendMessage(Long windowId, SendMessageRequest request) {
        SessionWindowContext context = requireWindowContext(windowId);
        GenerationLocale locale = resolveLocale(context.getUserId());
        validateQuestionForWindow(request.getQuestionId(), windowId, context);
        Long userId = resolveUserId(request.getUserId(), context);
        MessageRecord userMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .role("user")
            .content(request.getContent())
            .questionId(request.getQuestionId())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(true)
            .build());

        SendMessageRequest providerRequest = SendMessageRequest.builder()
            .content(request.getContent())
            .questionId(request.getQuestionId())
            .clientCorrelationId(request.getClientCorrelationId())
            .contextMessageId(userMessage.getId())
            .build();
        AiGenerationTask task = new AiGenerationTask(
            "WINDOW_MESSAGE", "window-message-v1", "text-v1", locale
        );
        AiGenerationResult<AiMessageResponse> generation = aiProvider.answerWindowMessageWithMetadata(
            windowId, providerRequest, task
        );
        generation = validateMessageGeneration(
            generation,
            locale,
            false,
            context.isTestData(),
            traceContext(context)
        );
        generationObserver.observe(generation, null, context.isTestData(), traceContext(context));
        AiMessageResponse aiResponse = requireGenerated(generation);
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .parentMessageId(userMessage.getId())
            .role(aiResponse.getRole())
            .content(aiResponse.getContent())
            .aiModel(aiResponse.getAiModel())
            .questionId(request.getQuestionId())
            .contextSnapshot(aiResponse.getContextSnapshot())
            .tokenUsage(aiResponse.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(locale.value())
            .languageValidationOutcome(outcomeName(generation))
            .testData(true)
            .build());

        return copyWithPersistedMessageId(aiResponse, aiMessage.getId());
    }

    /** AI 델타를 호출자에게 스트리밍하되 완료 뒤 최종 응답은 저장한다. */
    public AiMessageResponse streamMessage(Long windowId, SendMessageRequest request, Consumer<String> deltaConsumer) {
        SessionWindowContext context = requireWindowContext(windowId);
        GenerationLocale locale = resolveLocale(context.getUserId());
        validateQuestionForWindow(request.getQuestionId(), windowId, context);
        Long userId = resolveUserId(request.getUserId(), context);
        MessageRecord userMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .role("user")
            .content(request.getContent())
            .questionId(request.getQuestionId())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(true)
            .build());

        SendMessageRequest providerRequest = SendMessageRequest.builder()
            .content(request.getContent())
            .questionId(request.getQuestionId())
            .clientCorrelationId(request.getClientCorrelationId())
            .contextMessageId(userMessage.getId())
            .build();
        AiGenerationTask task = new AiGenerationTask(
            "WINDOW_MESSAGE_STREAM", "window-message-v1", "text-v1", locale
        );
        AiGenerationResult<AiMessageResponse> generation = aiProvider.streamWindowMessageWithMetadata(
            windowId, providerRequest, deltaConsumer, task
        );
        generation = validateMessageGeneration(
            generation,
            locale,
            true,
            context.isTestData(),
            traceContext(context)
        );
        generationObserver.observe(generation, null, context.isTestData(), traceContext(context));
        AiMessageResponse aiResponse = requireGenerated(generation);
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .parentMessageId(userMessage.getId())
            .role(aiResponse.getRole())
            .content(aiResponse.getContent())
            .aiModel(aiResponse.getAiModel())
            .questionId(request.getQuestionId())
            .contextSnapshot(aiResponse.getContextSnapshot())
            .tokenUsage(aiResponse.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(locale.value())
            .languageValidationOutcome(outcomeName(generation))
            .testData(true)
            .build());

        return copyWithPersistedMessageId(aiResponse, aiMessage.getId());
    }

    /** 접근 가능한 윈도우 하나의 활성 질문을 나열한다. */
    public QuestionListResponse questions(Long windowId) {
        requireWindowContext(windowId);

        return QuestionListResponse.builder()
            .questions(questionMapper.findByWindowId(windowId).stream().map(this::toQuestionDto).toList())
            .build();
    }

    /** 독자가 작성한 질문 하나를 윈도우에 추가한다. */
    public QuestionListResponse createQuestion(Long windowId, CreateQuestionRequest request) {
        SessionWindowContext context = requireWindowContext(windowId);
        QuestionDto question = QuestionDto.builder()
            .questionText(request.getQuestionText())
            .questionType(READER_QUESTION_TYPE)
            .status(ACTIVE_STATUS)
            .build();

        insertQuestion(context, windowId, question);
        return questions(windowId);
    }

    /** AI 질문을 생성하고 각 제안을 지속 가능한 프롬프트로 저장한다. */
    public QuestionListResponse generateQuestions(Long windowId, GenerateQuestionsRequest request) {
        SessionWindowContext context = requireWindowContext(windowId);
        GenerationLocale locale = resolveLocale(context.getUserId());
        AiGenerationTask task = new AiGenerationTask(
            "QUESTION_GENERATION", "question-generation-v1", "question-list-v1", locale
        );
        AiGenerationResult<QuestionListResponse> generation = aiProvider.suggestQuestionsWithMetadata(
            windowId, request, task
        );
        AiLanguageValidationOutcome validation = isOrdinaryFallback(generation)
            ? null
            : validateQuestions(locale, generation.value());
        if (validation == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
            generation = generation.withValue(
                localizedQuestionFallback(locale), "FALLBACK", true, validation
            );
        } else if (validation != null) {
            generation = generation.withLanguageValidation(validation);
        }
        generationObserver.observe(generation, null, context.isTestData(), traceContext(context));
        QuestionListResponse suggestions = requireGenerated(generation);
        AiLanguageValidationOutcome questionValidation = generation.languageValidationOutcome();

        return QuestionListResponse.builder()
            .questions(suggestions.getQuestions().stream()
                .map((suggestion) -> insertQuestion(
                    context, windowId, suggestion, locale, questionValidation
                ))
                .toList())
            .build();
    }

    /** 답변이 없는 질문만 소프트 삭제한다. */
    public QuestionDto deleteQuestion(Long questionId) {
        QuestionRecord record = requireDeletableQuestion(questionId);
        requireUpdated(questionMapper.softDelete(questionId, currentUserId()), "Question not found");
        return toQuestionDto(record);
    }

    /** debate window에 독자 프롬프트와 persona 응답 하나를 저장한다. */
    public DebateTurnResponse debate(Long windowId, DebateMessageRequest request) {
        SessionWindowContext context = requireWindowContext(windowId);
        GenerationLocale locale = resolveLocale(context.getUserId());
        requireActivePersona(request.getPersonaId());
        ModerationEventRecord moderation = moderate(context, request.getContent(), null, locale);
        if (blocksPersona(moderation)) {
            return debateTurn(moderation, List.of());
        }
        Long userId = resolveUserId(request.getUserId(), context);
        MessageRecord userMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .role("user")
            .content(request.getContent())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(true)
            .build());

        DebateMessageRequest providerRequest = DebateMessageRequest.builder()
            .personaId(request.getPersonaId())
            .content(request.getContent())
            .clientCorrelationId(request.getClientCorrelationId())
            .contextMessageId(userMessage.getId())
            .build();
        AiGenerationResult<AiMessageResponse> generation = personaGeneration(
            windowId,
            providerRequest,
            locale
        );
        generation = validateMessageGeneration(
            generation,
            locale,
            false,
            context.isTestData(),
            traceContext(context)
        );
        generationObserver.observe(generation, null, context.isTestData(), traceContext(context));
        AiMessageResponse aiResponse = requireGenerated(generation);
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .parentMessageId(userMessage.getId())
            .role(aiResponse.getRole())
            .content(aiResponse.getContent())
            .aiModel(aiResponse.getAiModel())
            .personaId(request.getPersonaId())
            .contextSnapshot(aiResponse.getContextSnapshot())
            .tokenUsage(aiResponse.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(locale.value())
            .languageValidationOutcome(outcomeName(generation))
            .testData(true)
            .build());

        AiMessageResponse persistedResponse = copyWithPersistedMessageId(aiResponse, aiMessage.getId());
        return debateTurn(finalizeAllowed(moderation, userMessage.getId()), List.of(persistedResponse));
    }

    /** 독자 토론 프롬프트 하나와 선택된 모든 persona의 응답을 저장한다. */
    public DebateTurnResponse debateAll(Long windowId, DebateAllMessageRequest request) {
        SessionWindowContext context = requireWindowContext(windowId);
        GenerationLocale locale = resolveLocale(context.getUserId());
        List<PersonaRecord> personas = selectedDebatePersonas(request.getPersonaIds());
        ModerationEventRecord moderation = moderate(context, request.getContent(), null, locale);
        if (blocksPersona(moderation)) {
            return debateTurn(moderation, List.of());
        }
        Long userId = resolveUserId(request.getUserId(), context);
        MessageRecord userMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .role("user")
            .content(request.getContent())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(true)
            .build());

        List<DebateMessageRequest> personaRequests = personas.stream()
            .map((persona) -> DebateMessageRequest.builder()
                .personaId(persona.getId())
                .content(userMessage.getContent())
                .clientCorrelationId(request.getClientCorrelationId())
                .contextMessageId(userMessage.getId())
                .build())
            .toList();
        AiGenerationResult<List<AiMessageResponse>> generation = personaBatchGeneration(
            windowId,
            personaRequests,
            locale
        );
        ValidatedPersonaBatch validated = validatePersonaBatch(generation, locale);
        generationObserver.observe(
            validated.generation(),
            null,
            context.isTestData(),
            traceContext(context)
        );
        requireGenerated(validated.generation());

        List<AiMessageResponse> persistedResponses = validated.items().stream()
            .map((item) -> insertPersonaDebateResponse(
                windowId, context, userId, userMessage, item.response(),
                locale, item.validationOutcome()
            ))
            .toList();
        return debateTurn(finalizeAllowed(moderation, userMessage.getId()), persistedResponses);
    }

    /** guided discussion에서 Director보다 먼저 기존 Moderator를 실행한다. */
    public ModerationEventRecord moderateGuidedTurn(
        Long windowId,
        String content,
        String depth,
        GenerationLocale locale
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        if (moderationBusiness == null || !moderationBusiness.isEnabled()) {
            return null;
        }
        return moderationBusiness.evaluate(context, content, depth, locale);
    }

    /** guided discussion이 차단 판정을 compact response로 반환할 수 있게 한다. */
    public boolean blocksGuidedTurn(ModerationEventRecord moderation) {
        return blocksPersona(moderation);
    }

    private DebateTurnResponse persistGuidedTurn(
        Long windowId,
        Long questionId,
        String content,
        DirectorDecision decision,
        ModerationEventRecord moderation
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        if (blocksPersona(moderation)) {
            return debateTurn(moderation, List.of());
        }
        if (decision == null || decision.displayContent() == null || decision.generationLocale() == null) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Director response is incomplete");
        }
        Long userId = resolveUserId(null, context);
        MessageRecord userMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .role("user")
            .content(content)
            .questionId(questionId)
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(context.isTestData())
            .build());

        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .parentMessageId(userMessage.getId())
            .role("assistant")
            .content(decision.displayContent())
            .aiModel("discussion-director")
            .questionId(questionId)
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(decision.generationLocale().value())
            .languageValidationOutcome(decision.languageValidationOutcome() == null
                ? null
                : decision.languageValidationOutcome().name())
            .testData(context.isTestData())
            .build());
        AiMessageResponse response = AiMessageResponse.builder()
            .messageId(aiMessage.getId())
            .windowId(windowId)
            .role("assistant")
            .content(decision.displayContent())
            .streamingReady(true)
            .aiModel("discussion-director")
            .build();
        ModerationEventRecord finalized = moderation == null
            ? null
            : moderationBusiness.finalizeAllowed(moderation, userMessage.getId(), false);
        return debateTurn(finalized, List.of(response));
    }

    /** Guided turn의 provider 결과 없이 message row만 짧은 transaction으로 저장한다. */
    @Transactional
    public DebateTurnResponse persistGuidedTurnAtomically(
        Long windowId,
        Long questionId,
        String content,
        DirectorDecision decision,
        ModerationEventRecord moderation
    ) {
        return persistGuidedTurn(windowId, questionId, content, decision, moderation);
    }

    /** Director가 고른 Persona의 provider 결과를 기존 reader message에 연결한다. */
    @Transactional
    public DebateTurnResponse persistGuidedPersonaResponse(
        Long windowId,
        Long questionId,
        Long personaId,
        MessageRecord userMessage,
        GeneratedAiMessage generated
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        requireActivePersona(personaId);
        if (userMessage == null || generated == null || generated.response().getContent() == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Persona response could not be persisted"
            );
        }
        AiMessageResponse response = generated.response();
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userMessage.getUserId())
            .parentMessageId(userMessage.getId())
            .role(response.getRole() == null ? "assistant" : response.getRole())
            .content(response.getContent())
            .aiModel(response.getAiModel())
            .personaId(personaId)
            .questionId(questionId)
            .contextSnapshot(response.getContextSnapshot())
            .tokenUsage(response.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(generated.generationLocale().value())
            .languageValidationOutcome(generated.languageValidationOutcome() == null
                ? null
                : generated.languageValidationOutcome().name())
            .testData(context.isTestData())
            .build());
        AiMessageResponse persisted = copyWithPersistedMessageId(
            AiMessageResponse.builder()
                .windowId(windowId)
                .personaId(personaId)
                .role(response.getRole() == null ? "assistant" : response.getRole())
                .content(response.getContent())
                .streamingReady(response.isStreamingReady())
                .aiModel(response.getAiModel())
                .contextSnapshot(response.getContextSnapshot())
                .tokenUsage(response.getTokenUsage())
                .build(),
            aiMessage.getId()
        );
        return debateTurn(null, List.of(persisted));
    }

    /** 구조 안내 뒤 선택한 Persona 응답을 차단된 reader message와 연결하지 않고 저장한다. */
    @Transactional
    public DebateTurnResponse persistStandaloneGuidedPersonaResponse(
        Long windowId,
        Long questionId,
        Long personaId,
        GeneratedAiMessage generated
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        requireActivePersona(personaId);
        if (generated == null || generated.response().getContent() == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Persona response could not be persisted"
            );
        }
        AiMessageResponse response = generated.response();
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(resolveUserId(null, context))
            .parentMessageId(null)
            .role(response.getRole() == null ? "assistant" : response.getRole())
            .content(response.getContent())
            .aiModel(response.getAiModel())
            .personaId(personaId)
            .questionId(questionId)
            .contextSnapshot(response.getContextSnapshot())
            .tokenUsage(response.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(generated.generationLocale().value())
            .languageValidationOutcome(generated.languageValidationOutcome() == null
                ? null
                : generated.languageValidationOutcome().name())
            .testData(context.isTestData())
            .build());
        AiMessageResponse persisted = copyWithPersistedMessageId(
            AiMessageResponse.builder()
                .windowId(windowId)
                .personaId(personaId)
                .role(response.getRole() == null ? "assistant" : response.getRole())
                .content(response.getContent())
                .streamingReady(response.isStreamingReady())
                .aiModel(response.getAiModel())
                .contextSnapshot(response.getContextSnapshot())
                .tokenUsage(response.getTokenUsage())
                .build(),
            aiMessage.getId()
        );
        return debateTurn(null, List.of(persisted));
    }

    /** Persona provider는 message/run transaction 밖에서 실행한다. */
    public GeneratedAiMessage generateGuidedPersonaResponse(
        Long windowId,
        Long personaId,
        String content,
        Long contextMessageId,
        String depth,
        GenerationLocale locale
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        requireActivePersona(personaId);
        DebateMessageRequest providerRequest = DebateMessageRequest.builder()
            .personaId(personaId)
            .content(content)
            .contextMessageId(contextMessageId)
            .build();
        AiGenerationResult<AiMessageResponse> generation = personaGeneration(
            windowId,
            providerRequest,
            locale
        );
        generation = validateMessageGeneration(
            generation,
            locale,
            false,
            context.isTestData(),
            traceContext(context)
        );
        generationObserver.observe(generation, depth, context.isTestData(), traceContext(context));
        if (generation == null
            || generation.value() == null
            || generation.fallbackUsed()
            || "FAILURE".equalsIgnoreCase(generation.outcome())) {
            throw new ApiException(
                ApiErrorCode.COMMON_UPSTREAM_ERROR,
                "Persona response could not be generated"
            );
        }
        return new GeneratedAiMessage(
            generation.value(),
            locale,
            generation.languageValidationOutcome()
        );
    }

    public record GeneratedAiMessage(
        AiMessageResponse response,
        GenerationLocale generationLocale,
        AiLanguageValidationOutcome languageValidationOutcome
    ) {
        public GeneratedAiMessage {
            Objects.requireNonNull(response, "response");
            Objects.requireNonNull(generationLocale, "generationLocale");
        }
    }

    /** feature flag가 켜진 경우에만 reader message 저장 전 판정 event를 만든다. */
    private ModerationEventRecord moderate(
        SessionWindowContext context,
        String content,
        String depth,
        GenerationLocale locale
    ) {
        if (moderationBusiness == null || !moderationBusiness.isEnabled()) {
            return null;
        }
        return moderationBusiness.evaluate(context, content, depth, locale);
    }

    private AiGenerationResult<AiMessageResponse> personaGeneration(
        Long windowId,
        DebateMessageRequest request,
        GenerationLocale locale
    ) {
        AiGenerationTask task = personaTask(locale);
        AiGenerationResult<AiMessageResponse> generation;
        long metadataStartedAt = System.nanoTime();
        try {
            generation = aiProvider.answerDebateMessageWithMetadata(windowId, request, task);
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(
                task,
                "unknown",
                "unknown",
                elapsedMillis(metadataStartedAt)
            );
        }
        return generation == null
            ? AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(metadataStartedAt))
            : generation;
    }

    private AiGenerationResult<List<AiMessageResponse>> personaBatchGeneration(
        Long windowId,
        List<DebateMessageRequest> requests,
        GenerationLocale locale
    ) {
        AiGenerationTask task = personaTask(locale);
        AiGenerationResult<List<AiMessageResponse>> generation;
        long metadataStartedAt = System.nanoTime();
        try {
            generation = aiProvider.answerDebateMessagesWithMetadata(windowId, requests, task);
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(
                task,
                "unknown",
                "unknown",
                elapsedMillis(metadataStartedAt)
            );
        }
        return generation == null
            ? AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(metadataStartedAt))
            : generation;
    }

    private AiGenerationTask personaTask(GenerationLocale locale) {
        return new AiGenerationTask("PERSONA", "persona-response-v1", "text-v1", locale);
    }

    private <T> T requireGenerated(AiGenerationResult<T> generation) {
        if (generation == null || generation.value() == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "AI response could not be generated"
            );
        }
        return generation.value();
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }

    /** redirect/reject는 message 저장과 Persona 호출을 모두 차단한다. */
    private boolean blocksPersona(ModerationEventRecord moderation) {
        return moderation != null
            && ModerationDecision.valueOf(moderation.getDecision()) != ModerationDecision.ALLOW;
    }

    /** 허용된 판정에 reader message와 실제 Persona 호출 결과를 연결한다. */
    private ModerationEventRecord finalizeAllowed(ModerationEventRecord moderation, Long messageId) {
        if (moderation == null) {
            return null;
        }
        return moderationBusiness.finalizeAllowed(moderation, messageId, true);
    }

    /** single/batch/차단 결과를 하나의 public response shape로 정규화한다. */
    private DebateTurnResponse debateTurn(
        ModerationEventRecord moderation,
        List<AiMessageResponse> messages
    ) {
        return DebateTurnResponse.builder()
            .moderation(moderation == null ? null : moderationBusiness.toDto(moderation))
            .messages(messages)
            .build();
    }

    /** 소유권, 세션 식별자, 사용자 식별자 전달에 쓰는 윈도우 context을 로드한다. */
    private SessionWindowContext requireWindowContext(Long windowId) {
        SessionWindowContext context = sessionWindowMapper.findContextById(windowId);
        if (context == null || !Objects.equals(context.getUserId(), currentUserId())) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Session window not found");
        }
        return context;
    }

    /** 클라이언트가 보낸 사용자 식별자보다 윈도우 소유자를 우선한다. */
    private Long resolveUserId(Long ignoredRequestUserId, SessionWindowContext context) {
        if (context.getUserId() != null) {
            return context.getUserId();
        }
        return currentUserId();
    }

    /** 참조된 질문이 메시지와 같은 세션 윈도우에 속하는지 확인한다. */
    private void validateQuestionForWindow(Long questionId, Long windowId, SessionWindowContext context) {
        if (questionId == null) {
            return;
        }

        QuestionRecord question = questionMapper.findActiveById(questionId, resolveUserId(null, context));
        if (question == null
            || !context.getSessionId().equals(question.getSessionId())
            || !windowId.equals(question.getWindowId())) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Question not found for session window");
        }
    }

    /** 토론 메시지가 대상 지정할 수 있도록 persona 행이 활성 상태인지 요구한다. */
    private PersonaRecord requireActivePersona(Long personaId) {
        PersonaRecord persona = personaMapper.findActiveByIdForUser(personaId, currentUserId());
        if (persona == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Persona not found");
        }
        return persona;
    }

    /** 명시 persona 식별자를 해석하거나 브로드캐스트 토론에는 모든 활성 persona를 기본값으로 쓴다. */
    private List<PersonaRecord> selectedDebatePersonas(List<Long> personaIds) {
        if (personaIds == null || personaIds.isEmpty()) {
            return personaMapper.findActiveForUser(currentUserId()).stream().limit(MAX_BATCH_PERSONAS).toList();
        }

        List<Long> distinctIds = personaIds.stream().distinct().toList();
        if (distinctIds.size() > MAX_BATCH_PERSONAS) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "At most two personas can reply together");
        }
        return distinctIds.stream()
            .distinct()
            .map(this::requireActivePersona)
            .toList();
    }

    /** 다음 메시지 순서를 부여하고 행을 저장한다. */
    private MessageRecord insertMessage(MessageRecord record) {
        record.setMessageOrder(messageMapper.selectNextOrder(record.getSessionId(), record.getWindowId()));
        requireInserted(messageMapper.insert(record), "Message could not be saved");
        return record;
    }

    /** 저장된 메시지 식별자를 붙인 AI 응답을 반환한다. */
    private AiMessageResponse copyWithPersistedMessageId(AiMessageResponse response, Long messageId) {
        return AiMessageResponse.builder()
            .messageId(messageId)
            .windowId(response.getWindowId())
            .personaId(response.getPersonaId())
            .role(response.getRole())
            .content(response.getContent())
            .streamingReady(response.isStreamingReady())
            .aiModel(response.getAiModel())
            .contextSnapshot(response.getContextSnapshot())
            .tokenUsage(response.getTokenUsage())
            .build();
    }

    /** 공유 사용자 토론 메시지에 연결된 persona 응답 하나를 저장한다. */
    private AiMessageResponse insertPersonaDebateResponse(
        Long windowId,
        SessionWindowContext context,
        Long userId,
        MessageRecord userMessage,
        AiMessageResponse aiResponse,
        GenerationLocale locale,
        AiLanguageValidationOutcome validationOutcome
    ) {
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userId)
            .parentMessageId(userMessage.getId())
            .role(aiResponse.getRole())
            .content(aiResponse.getContent())
            .aiModel(aiResponse.getAiModel())
            .personaId(aiResponse.getPersonaId())
            .contextSnapshot(aiResponse.getContextSnapshot())
            .tokenUsage(aiResponse.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .generationLocale(locale.value())
            .languageValidationOutcome(
                validationOutcome == null ? null : validationOutcome.name()
            )
            .testData(true)
            .build());

        return copyWithPersistedMessageId(aiResponse, aiMessage.getId());
    }

    /** 생성되었거나 독자가 작성한 질문을 대상 윈도우에 저장한다. */
    private QuestionDto insertQuestion(SessionWindowContext context, Long windowId, QuestionDto suggestion) {
        return insertQuestion(context, windowId, suggestion, null, null);
    }

    private QuestionDto insertQuestion(
        SessionWindowContext context,
        Long windowId,
        QuestionDto suggestion,
        GenerationLocale locale,
        AiLanguageValidationOutcome validationOutcome
    ) {
        QuestionRecord record = QuestionRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(resolveUserId(null, context))
            .questionText(suggestion.getQuestionText())
            .questionType(suggestion.getQuestionType() == null ? "reflection" : suggestion.getQuestionType())
            .status(ACTIVE_STATUS)
            .aiModel(suggestion.getAiModel())
            .generationLocale(locale == null ? null : locale.value())
            .languageValidationOutcome(validationOutcome == null ? null : validationOutcome.name())
            .testData(true)
            .build();

        requireInserted(questionMapper.insert(record), "Question could not be saved");
        return toQuestionDto(record);
    }

    private AiGenerationResult<AiMessageResponse> validateMessageGeneration(
        AiGenerationResult<AiMessageResponse> generation,
        GenerationLocale locale,
        boolean streaming,
        boolean testData,
        AiTraceContext traceContext
    ) {
        AiMessageResponse value = generation == null ? null : generation.value();
        if (value == null) return generation;
        if (isOrdinaryFallback(generation)) return generation;
        AiLanguageValidationOutcome validation = languageValidator.validate(locale, value.getContent());
        if (validation != AiLanguageValidationOutcome.KNOWN_MISMATCH) {
            return generation.withLanguageValidation(validation);
        }
        if (streaming) {
            AiGenerationResult<AiMessageResponse> failure = generation
                .<AiMessageResponse>withValue(null, "FAILURE", false, validation)
                .withFailureCategory("SCHEMA_VALIDATION")
                .withLanguageValidation(validation);
            generationObserver.observe(failure, null, testData, traceContext);
            throw new ApiException(ApiErrorCode.STREAM_MESSAGE_FAILED, "AI response language mismatch");
        }
        AiMessageResponse fallback = localizedMessageFallback(value, locale);
        return generation.withValue(fallback, "FALLBACK", true, validation);
    }

    private ValidatedPersonaBatch validatePersonaBatch(
        AiGenerationResult<List<AiMessageResponse>> generation,
        GenerationLocale locale
    ) {
        if (generation == null || generation.value() == null) {
            return new ValidatedPersonaBatch(generation, List.of());
        }
        if (isOrdinaryFallback(generation)) {
            return new ValidatedPersonaBatch(
                generation,
                generation.value().stream()
                    .map(response -> new ValidatedPersonaMessage(response, null))
                    .toList()
            );
        }
        boolean replaced = false;
        boolean matched = false;
        List<ValidatedPersonaMessage> items = new ArrayList<>();
        for (AiMessageResponse response : generation.value()) {
            AiLanguageValidationOutcome itemOutcome = languageValidator.validate(
                locale,
                response.getContent()
            );
            if (itemOutcome == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
                items.add(new ValidatedPersonaMessage(
                    localizedMessageFallback(response, locale),
                    itemOutcome
                ));
                replaced = true;
            } else {
                items.add(new ValidatedPersonaMessage(response, itemOutcome));
                matched = matched || itemOutcome == AiLanguageValidationOutcome.MATCH;
            }
        }
        AiGenerationResult<List<AiMessageResponse>> aggregate = generation.withValue(
            items.stream().map(ValidatedPersonaMessage::response).toList(),
            replaced ? "FALLBACK" : generation.outcome(),
            replaced || generation.fallbackUsed(),
            replaced
                ? AiLanguageValidationOutcome.KNOWN_MISMATCH
                : matched ? AiLanguageValidationOutcome.MATCH : AiLanguageValidationOutcome.UNKNOWN
        );
        return new ValidatedPersonaBatch(aggregate, List.copyOf(items));
    }

    private record ValidatedPersonaMessage(
        AiMessageResponse response,
        AiLanguageValidationOutcome validationOutcome
    ) {
    }

    private record ValidatedPersonaBatch(
        AiGenerationResult<List<AiMessageResponse>> generation,
        List<ValidatedPersonaMessage> items
    ) {
    }

    private boolean isOrdinaryFallback(AiGenerationResult<?> generation) {
        return generation != null
            && generation.fallbackUsed()
            && generation.languageValidationOutcome() == null;
    }

    private AiLanguageValidationOutcome validateQuestions(
        GenerationLocale locale,
        QuestionListResponse response
    ) {
        if (response == null || response.getQuestions() == null) {
            return AiLanguageValidationOutcome.UNKNOWN;
        }
        return languageValidator.validateUnits(
            locale,
            response.getQuestions().stream().map(QuestionDto::getQuestionText).toList()
        );
    }

    private QuestionListResponse localizedQuestionFallback(GenerationLocale locale) {
        String text = locale == GenerationLocale.KO
            ? "이 장면에서 가장 중요하게 느껴진 선택은 무엇인가요?"
            : "Which choice in this scene feels most important to you?";
        return QuestionListResponse.builder().questions(List.of(
            QuestionDto.builder().questionText(text).questionType("reflection").aiModel("placeholder").build()
        )).build();
    }

    private AiMessageResponse localizedMessageFallback(AiMessageResponse source, GenerationLocale locale) {
        return AiMessageResponse.builder()
            .windowId(source.getWindowId())
            .personaId(source.getPersonaId())
            .role(source.getRole() == null ? "assistant" : source.getRole())
            .content(locale == GenerationLocale.KO
                ? "지금 남은 생각을 한 문장으로 더 들려주세요."
                : "Tell me one more sentence about the thought that remains with you.")
            .streamingReady(true)
            .aiModel("placeholder")
            .contextSnapshot(source.getContextSnapshot())
            .tokenUsage(source.getTokenUsage())
            .build();
    }

    private String outcomeName(AiGenerationResult<?> generation) {
        return generation.languageValidationOutcome() == null
            ? null
            : generation.languageValidationOutcome().name();
    }

    private GenerationLocale resolveLocale(Long userId) {
        if (generationLocaleResolver == null) {
            throw new IllegalStateException("GenerationLocaleResolver is required");
        }
        return generationLocaleResolver.resolve(userId);
    }

    /** 이미 참조하는 사용자 답변이 없을 때만 질문 삭제를 허용한다. */
    private QuestionRecord requireDeletableQuestion(Long questionId) {
        QuestionRecord record = questionMapper.findActiveById(questionId, currentUserId());
        if (record == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Question not found");
        }
        if (questionMapper.countActiveUserAnswers(questionId) > 0) {
            throw new ApiException(ApiErrorCode.SESSION_ANSWERED_QUESTION_DELETE_CONFLICT);
        }
        return record;
    }

    /** 매퍼 갱신 누락을 API 찾을 수 없음/충돌 동작으로 변환한다. */
    private void requireUpdated(int updatedRows, String reason) {
        if (updatedRows <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, reason);
        }
    }

    /** 검증이 이미 통과된 상태이므로 삽입 실패를 서버 오류로 변환한다. */
    private void requireInserted(int insertedRows, String reason) {
        if (insertedRows <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
        }
    }

    /** 질문 저장 행을 API DTO로 매핑한다. */
    private QuestionDto toQuestionDto(QuestionRecord record) {
        return QuestionDto.builder()
            .questionId(record.getId())
            .sessionId(record.getSessionId())
            .windowId(record.getWindowId())
            .questionText(record.getQuestionText())
            .questionType(record.getQuestionType())
            .status(record.getStatus())
            .aiModel(record.getAiModel())
            .build();
    }
}
