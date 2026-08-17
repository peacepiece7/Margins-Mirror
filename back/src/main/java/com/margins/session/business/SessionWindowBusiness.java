package com.margins.session.business;

import com.margins.auth.support.AuthContext;
import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
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
    private SessionWindowPersonaMapper sessionWindowPersonaMapper;
    private ModerationBusiness moderationBusiness;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;

    @Autowired
    void configureModeration(ModerationBusiness moderationBusiness) {
        this.moderationBusiness = moderationBusiness;
    }

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
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
        AiMessageResponse aiResponse = aiProvider.answerWindowMessage(windowId, providerRequest);
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
            .testData(true)
            .build());

        return copyWithPersistedMessageId(aiResponse, aiMessage.getId());
    }

    /** AI 델타를 호출자에게 스트리밍하되 완료 뒤 최종 응답은 저장한다. */
    public AiMessageResponse streamMessage(Long windowId, SendMessageRequest request, Consumer<String> deltaConsumer) {
        SessionWindowContext context = requireWindowContext(windowId);
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
        AiMessageResponse aiResponse = aiProvider.streamWindowMessage(windowId, providerRequest, deltaConsumer);
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
        QuestionListResponse suggestions = aiProvider.suggestQuestions(windowId, request);

        return QuestionListResponse.builder()
            .questions(suggestions.getQuestions().stream()
                .map((suggestion) -> insertQuestion(context, windowId, suggestion))
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
        requireActivePersona(request.getPersonaId());
        ModerationEventRecord moderation = moderate(context, request.getContent());
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
            providerRequest
        );
        generationObserver.observe(generation, null, context.isTestData());
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
            .testData(true)
            .build());

        AiMessageResponse persistedResponse = copyWithPersistedMessageId(aiResponse, aiMessage.getId());
        return debateTurn(finalizeAllowed(moderation, userMessage.getId()), List.of(persistedResponse));
    }

    /** 독자 토론 프롬프트 하나와 선택된 모든 persona의 응답을 저장한다. */
    public DebateTurnResponse debateAll(Long windowId, DebateAllMessageRequest request) {
        SessionWindowContext context = requireWindowContext(windowId);
        List<PersonaRecord> personas = selectedDebatePersonas(request.getPersonaIds());
        ModerationEventRecord moderation = moderate(context, request.getContent());
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
            personaRequests
        );
        generationObserver.observe(generation, null, context.isTestData());
        List<AiMessageResponse> aiResponses = requireGenerated(generation);

        List<AiMessageResponse> persistedResponses = aiResponses.stream()
            .map((aiResponse) -> insertPersonaDebateResponse(windowId, context, userId, userMessage, aiResponse))
            .toList();
        return debateTurn(finalizeAllowed(moderation, userMessage.getId()), persistedResponses);
    }

    /** guided discussion에서 Director보다 먼저 기존 Moderator를 실행한다. */
    public ModerationEventRecord moderateGuidedTurn(Long windowId, String content) {
        return moderateGuidedTurn(windowId, content, null);
    }

    public ModerationEventRecord moderateGuidedTurn(
        Long windowId,
        String content,
        String depth
    ) {
        return moderate(requireWindowContext(windowId), content, depth);
    }

    /** guided discussion이 차단 판정을 compact response로 반환할 수 있게 한다. */
    public boolean blocksGuidedTurn(ModerationEventRecord moderation) {
        return blocksPersona(moderation);
    }

    /**
     * Moderator와 Director 결정 뒤 reader turn과 Director 또는 Persona 응답 하나를
     * 현재 guide question trace에 저장한다.
     */
    public DebateTurnResponse persistGuidedTurn(
        Long windowId,
        Long questionId,
        Long personaId,
        String content,
        String directorReply,
        ModerationEventRecord moderation
    ) {
        return persistGuidedTurn(
            windowId,
            questionId,
            personaId,
            content,
            directorReply,
            moderation,
            null
        );
    }

    public DebateTurnResponse persistGuidedTurn(
        Long windowId,
        Long questionId,
        Long personaId,
        String content,
        String directorReply,
        ModerationEventRecord moderation,
        String depth
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        if (blocksPersona(moderation)) {
            return debateTurn(moderation, List.of());
        }
        if (personaId != null) {
            requireActivePersona(personaId);
        }
        AiMessageResponse generatedResponse = personaId == null
            ? null
            : generateGuidedPersonaResponse(windowId, personaId, content, null, depth);
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

        AiMessageResponse response;
        if (personaId != null) {
            AiMessageResponse generated = generatedResponse;
            MessageRecord aiMessage = insertMessage(MessageRecord.builder()
                .sessionId(context.getSessionId())
                .windowId(windowId)
                .userId(userId)
                .parentMessageId(userMessage.getId())
                .role(generated.getRole())
                .content(generated.getContent())
                .aiModel(generated.getAiModel())
                .personaId(personaId)
                .questionId(questionId)
                .contextSnapshot(generated.getContextSnapshot())
                .tokenUsage(generated.getTokenUsage())
                .streamingStatus(COMPLETE_STREAMING_STATUS)
                .testData(context.isTestData())
                .build());
            response = copyWithPersistedMessageId(generated, aiMessage.getId());
        } else {
            String reply = directorReply == null || directorReply.isBlank()
                ? "이 지점에서 한 문장만 더 구체화해 볼까요?"
                : directorReply.trim();
            MessageRecord aiMessage = insertMessage(MessageRecord.builder()
                .sessionId(context.getSessionId())
                .windowId(windowId)
                .userId(userId)
                .parentMessageId(userMessage.getId())
                .role("assistant")
                .content(reply)
                .aiModel("discussion-director")
                .questionId(questionId)
                .streamingStatus(COMPLETE_STREAMING_STATUS)
                .testData(context.isTestData())
                .build());
            response = AiMessageResponse.builder()
                .messageId(aiMessage.getId())
                .windowId(windowId)
                .role("assistant")
                .content(reply)
                .streamingReady(true)
                .aiModel("discussion-director")
                .build();
        }
        ModerationEventRecord finalized = moderation == null
            ? null
            : moderationBusiness.finalizeAllowed(moderation, userMessage.getId(), personaId != null);
        return debateTurn(finalized, List.of(response));
    }

    /** Guided turn의 provider 결과 없이 message row만 짧은 transaction으로 저장한다. */
    @Transactional
    public DebateTurnResponse persistGuidedTurnAtomically(
        Long windowId,
        Long questionId,
        String content,
        String directorReply,
        ModerationEventRecord moderation,
        String depth
    ) {
        return persistGuidedTurn(
            windowId,
            questionId,
            null,
            content,
            directorReply,
            moderation,
            depth
        );
    }

    /** Director가 고른 Persona의 provider 결과를 기존 reader message에 연결한다. */
    @Transactional
    public DebateTurnResponse persistGuidedPersonaResponse(
        Long windowId,
        Long questionId,
        Long personaId,
        MessageRecord userMessage,
        AiMessageResponse generated
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        requireActivePersona(personaId);
        if (userMessage == null || generated == null || generated.getContent() == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Persona response could not be persisted"
            );
        }
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(userMessage.getUserId())
            .parentMessageId(userMessage.getId())
            .role(generated.getRole() == null ? "assistant" : generated.getRole())
            .content(generated.getContent())
            .aiModel(generated.getAiModel())
            .personaId(personaId)
            .questionId(questionId)
            .contextSnapshot(generated.getContextSnapshot())
            .tokenUsage(generated.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(context.isTestData())
            .build());
        AiMessageResponse persisted = copyWithPersistedMessageId(
            AiMessageResponse.builder()
                .windowId(windowId)
                .personaId(personaId)
                .role(generated.getRole() == null ? "assistant" : generated.getRole())
                .content(generated.getContent())
                .streamingReady(generated.isStreamingReady())
                .aiModel(generated.getAiModel())
                .contextSnapshot(generated.getContextSnapshot())
                .tokenUsage(generated.getTokenUsage())
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
        AiMessageResponse generated
    ) {
        SessionWindowContext context = requireWindowContext(windowId);
        requireActivePersona(personaId);
        if (generated == null || generated.getContent() == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Persona response could not be persisted"
            );
        }
        MessageRecord aiMessage = insertMessage(MessageRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(resolveUserId(null, context))
            .parentMessageId(null)
            .role(generated.getRole() == null ? "assistant" : generated.getRole())
            .content(generated.getContent())
            .aiModel(generated.getAiModel())
            .personaId(personaId)
            .questionId(questionId)
            .contextSnapshot(generated.getContextSnapshot())
            .tokenUsage(generated.getTokenUsage())
            .streamingStatus(COMPLETE_STREAMING_STATUS)
            .testData(context.isTestData())
            .build());
        AiMessageResponse persisted = copyWithPersistedMessageId(
            AiMessageResponse.builder()
                .windowId(windowId)
                .personaId(personaId)
                .role(generated.getRole() == null ? "assistant" : generated.getRole())
                .content(generated.getContent())
                .streamingReady(generated.isStreamingReady())
                .aiModel(generated.getAiModel())
                .contextSnapshot(generated.getContextSnapshot())
                .tokenUsage(generated.getTokenUsage())
                .build(),
            aiMessage.getId()
        );
        return debateTurn(null, List.of(persisted));
    }

    /** Persona provider는 message/run transaction 밖에서 실행한다. */
    public AiMessageResponse generateGuidedPersonaResponse(
        Long windowId,
        Long personaId,
        String content,
        Long contextMessageId,
        String depth
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
            providerRequest
        );
        generationObserver.observe(generation, depth, context.isTestData());
        if (generation == null
            || generation.value() == null
            || "FAILURE".equalsIgnoreCase(generation.outcome())
            || (generation.fallbackUsed()
                && !"placeholder".equalsIgnoreCase(generation.provider()))) {
            throw new ApiException(
                ApiErrorCode.COMMON_UPSTREAM_ERROR,
                "Persona response could not be generated"
            );
        }
        return generation.value();
    }

    /** feature flag가 켜진 경우에만 reader message 저장 전 판정 event를 만든다. */
    private ModerationEventRecord moderate(SessionWindowContext context, String content) {
        return moderate(context, content, null);
    }

    private ModerationEventRecord moderate(
        SessionWindowContext context,
        String content,
        String depth
    ) {
        if (moderationBusiness == null || !moderationBusiness.isEnabled()) {
            return null;
        }
        return depth == null
            ? moderationBusiness.evaluate(context, content)
            : moderationBusiness.evaluate(context, content, depth);
    }

    private AiGenerationResult<AiMessageResponse> personaGeneration(
        Long windowId,
        DebateMessageRequest request
    ) {
        AiGenerationTask task = personaTask();
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
        if (generation != null) {
            return generation;
        }
        long startedAt = System.nanoTime();
        try {
            AiMessageResponse response = aiProvider.answerDebateMessage(windowId, request);
            return legacyMessageGeneration(response, task, elapsedMillis(startedAt));
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    private AiGenerationResult<List<AiMessageResponse>> personaBatchGeneration(
        Long windowId,
        List<DebateMessageRequest> requests
    ) {
        AiGenerationTask task = personaTask();
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
        if (generation != null) {
            return generation;
        }
        long startedAt = System.nanoTime();
        try {
            List<AiMessageResponse> responses = aiProvider.answerDebateMessages(windowId, requests);
            AiMessageResponse first = responses == null
                ? null
                : responses.stream().filter(Objects::nonNull).findFirst().orElse(null);
            AiGenerationResult<AiMessageResponse> metadata = legacyMessageGeneration(
                first,
                task,
                elapsedMillis(startedAt)
            );
            return new AiGenerationResult<>(
                responses,
                metadata.taskType(),
                metadata.provider(),
                metadata.model(),
                metadata.promptVersion(),
                metadata.schemaVersion(),
                metadata.inputTokens(),
                metadata.cachedInputTokens(),
                metadata.outputTokens(),
                metadata.latencyMs(),
                metadata.outcome(),
                metadata.fallbackUsed(),
                metadata.failureCategory()
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    private AiGenerationResult<AiMessageResponse> legacyMessageGeneration(
        AiMessageResponse response,
        AiGenerationTask task,
        int latencyMs
    ) {
        if (response == null) {
            return AiGenerationResult.failure(task, "unknown", "unknown", latencyMs);
        }
        String model = response.getAiModel();
        boolean fallbackUsed = "placeholder".equalsIgnoreCase(model);
        return AiGenerationResult.completed(
            response,
            task,
            fallbackUsed ? "placeholder" : "unknown",
            model,
            AiTokenUsage.fromJson(response.getTokenUsage()),
            latencyMs,
            fallbackUsed ? "FALLBACK" : "SUCCESS",
            fallbackUsed
        );
    }

    private AiGenerationTask personaTask() {
        return new AiGenerationTask("PERSONA", "persona-response-v1", "text-v1");
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
        AiMessageResponse aiResponse
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
            .testData(true)
            .build());

        return copyWithPersistedMessageId(aiResponse, aiMessage.getId());
    }

    /** 생성되었거나 독자가 작성한 질문을 대상 윈도우에 저장한다. */
    private QuestionDto insertQuestion(SessionWindowContext context, Long windowId, QuestionDto suggestion) {
        QuestionRecord record = QuestionRecord.builder()
            .sessionId(context.getSessionId())
            .windowId(windowId)
            .userId(resolveUserId(null, context))
            .questionText(suggestion.getQuestionText())
            .questionType(suggestion.getQuestionType() == null ? "reflection" : suggestion.getQuestionType())
            .status(ACTIVE_STATUS)
            .aiModel(suggestion.getAiModel())
            .testData(true)
            .build();

        requireInserted(questionMapper.insert(record), "Question could not be saved");
        return toQuestionDto(record);
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
