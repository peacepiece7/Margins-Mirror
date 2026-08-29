package com.margins.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.book.dto.BookKnowledgeAnalyzeRequest;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.BookKnowledgeProperties;
import com.margins.book.mapper.BookKnowledgeMapper;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.DiscussionGuideGeneration.Response;
import com.margins.ai.provider.OpenAiDiscussionGuideClient;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.mapper.ReflectionSummaryMapper;
import com.margins.reflectionloop.model.ReflectionSummaryRecord;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.SessionWindowContext;
import com.margins.session.model.SessionWindowRecord;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@ConditionalOnProperty(name = "margins.ai.provider", havingValue = "openai")
public class OpenAiAiProvider implements AiProvider {

    private static final String READING_COMPANION_RULES = """
        You are a respectful reading discussion companion.
        Do not claim one definitive interpretation.
        Connect to the reader's latest point, offer a distinct supported perspective, and avoid invented book facts.
        """;

    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper;
    private final SessionWindowMapper sessionWindowMapper;
    private final MessageMapper messageMapper;
    private final QuestionMapper questionMapper;
    private final PersonaMapper personaMapper;
    private final OpenAiResponsesTransport responsesTransport;
    private final OpenAiDiscussionGuideClient discussionGuideClient;
    private final PlaceholderAiProvider fallback = new PlaceholderAiProvider();

    @Autowired(required = false)
    private BookKnowledgeMapper bookKnowledgeMapper;

    @Autowired(required = false)
    private BookKnowledgeProperties bookKnowledgeProperties;

    @Autowired(required = false)
    private ReflectionSummaryMapper reflectionSummaryMapper;

    @Autowired(required = false)
    private AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();

    @Autowired
    public OpenAiAiProvider(
        OpenAiProperties properties,
        ObjectMapper objectMapper,
        SessionWindowMapper sessionWindowMapper,
        MessageMapper messageMapper,
        QuestionMapper questionMapper,
        PersonaMapper personaMapper,
        OpenAiResponsesTransport responsesTransport,
        OpenAiDiscussionGuideClient discussionGuideClient
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.sessionWindowMapper = sessionWindowMapper;
        this.messageMapper = messageMapper;
        this.questionMapper = questionMapper;
        this.personaMapper = personaMapper;
        this.responsesTransport = responsesTransport;
        this.discussionGuideClient = discussionGuideClient;
    }

    public OpenAiAiProvider(
        OpenAiProperties properties,
        ObjectMapper objectMapper,
        SessionWindowMapper sessionWindowMapper,
        MessageMapper messageMapper,
        QuestionMapper questionMapper,
        PersonaMapper personaMapper,
        OpenAiResponsesTransport responsesTransport
    ) {
        this(
            properties,
            objectMapper,
            sessionWindowMapper,
            messageMapper,
            questionMapper,
            personaMapper,
            responsesTransport,
            new OpenAiDiscussionGuideClient(
                properties,
                objectMapper,
                responsesTransport
            )
        );
    }

    @Override
    public AiGenerationResult<BookKnowledgeDto> analyzeBookKnowledgeWithMetadata(
        BookKnowledgeAnalyzeRequest request
    ) {
        if (!configured()) {
            return AiProvider.super.analyzeBookKnowledgeWithMetadata(request);
        }

        long startedAt = System.nanoTime();
        AiGenerationTask task = new AiGenerationTask(
            "BOOK_KNOWLEDGE",
            request.getPromptVersion(),
            "book-knowledge-schema-v1",
            request.getGenerationLocale()
        );
        GeneratedText generated = null;
        try {
            generated = createTextResult(
                "Analyze the book for a reading discussion app. Return only JSON with summary, themes, discussionPoints, recommendedPersonas, famousQuotes, keywords, and version. "
                    + request.getGenerationLocale().languageInstruction()
                    + " Keep the summary around 300-600 characters. Discussion points must be open-ended. Each discussion point must include id, question, rationale, and exactly two recommendedPersonaKeys from psychological-counselor, journalist, elementary-school-teacher, college-student, neighborhood-grandmother, soldier, middle-school-teacher, lawyer, university-professor, doctor, developer, writer.",
                "Title: " + safe(request.getTitle())
                    + "\nAuthor: " + safe(request.getAuthor())
                    + "\nISBN: " + safe(request.getIsbn())
                    + "\nPublished year: " + request.getPublishedYear()
                    + "\nLanguage: " + safe(request.getLanguage())
                    + "\nDescription: " + safe(request.getDescription())
                    + "\nVersion: " + safe(request.getPromptVersion())
            );
            BookKnowledgeDto parsed = parseBookKnowledge(request, generated.text());
            if (parsed.getSummary() == null || parsed.getSummary().isBlank()
                || parsed.getDiscussionPoints() == null || parsed.getDiscussionPoints().isEmpty()) {
                return AiGenerationResult.completed(
                    AiProvider.super.fallbackBookKnowledge(request),
                    task,
                    "openai",
                    properties.getModel(),
                    AiTokenUsage.fromJson(generated.tokenUsage()),
                    elapsedMillis(startedAt),
                    "FALLBACK",
                    true
                );
            }
            return AiGenerationResult.completed(
                parsed,
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.fromJson(generated.tokenUsage()),
                elapsedMillis(startedAt),
                "SUCCESS",
                false
            );
        } catch (RuntimeException exception) {
            logOpenAiFallback("book knowledge", exception);
            return AiGenerationResult.completed(
                AiProvider.super.fallbackBookKnowledge(request),
                task,
                "openai",
                properties.getModel(),
                generated == null
                    ? AiTokenUsage.NONE
                    : AiTokenUsage.fromJson(generated.tokenUsage()),
                elapsedMillis(startedAt),
                "FALLBACK",
                true
            );
        }
    }

    @Override
    public AiGenerationResult<QuestionListResponse> suggestQuestionsWithMetadata(
        Long windowId,
        GenerateQuestionsRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        if (!configured()) {
            return fallback.suggestQuestionsWithMetadata(windowId, request, task);
        }

        try {
            String context = contextForWindow(windowId, null, null, task.generationLocale());
            GeneratedText generated = createTextResult(
                task.generationLocale() == GenerationLocale.KO
                    ? "Generate concise reading reflection questions in Korean. Every questionText must be natural Korean, even when the focus contains English titles or names. Return a JSON array of objects with questionText and questionType."
                    : "Generate concise reading reflection questions in English. Every questionText must be natural English, even when the focus contains Korean titles or names. Return a JSON array of objects with questionText and questionType.",
                context + "\nFocus: " + safe(request.getFocus()) + "\nCount: " + (request.getCount() == null ? 3 : request.getCount())
            );
            List<QuestionDto> questions = parseQuestions(windowId, generated.text());
            if (questions.isEmpty()) {
                QuestionListResponse response = fallback
                    .suggestQuestionsWithMetadata(windowId, request, task)
                    .value();
                return AiGenerationResult.completed(
                    response,
                    task,
                    "openai",
                    properties.getModel(),
                    AiTokenUsage.fromJson(generated.tokenUsage()),
                    elapsedMillis(startedAt),
                    "FALLBACK",
                    true
                );
            }

            return AiGenerationResult.completed(
                QuestionListResponse.builder().questions(questions).build(),
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.fromJson(generated.tokenUsage()),
                elapsedMillis(startedAt),
                "SUCCESS",
                false
            );
        } catch (RuntimeException exception) {
            logOpenAiFallback("question generation", exception);
            QuestionListResponse response = fallback
                .suggestQuestionsWithMetadata(windowId, request, task)
                .value();
            return AiGenerationResult.completed(
                response,
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                "FALLBACK",
                true
            );
        }
    }

    @Override
    public Response generateDiscussionGuide(Request request) {
        return discussionGuideClient.generate(
            request,
            () -> AiProvider.super.generateDiscussionGuide(request)
        );
    }

    @Override
    public AiGenerationResult<Response> generateDiscussionGuideWithMetadata(Request request) {
        return discussionGuideClient.generateWithMetadata(
            request,
            () -> AiProvider.super.generateDiscussionGuide(request)
        );
    }

    @Override
    public AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        if (!configured()) {
            return fallback.answerWindowMessageWithMetadata(windowId, request, task);
        }

        try {
            GeneratedText generated = createTextResult(
                task.generationLocale().languageInstruction() + " "
                    + READING_COMPANION_RULES + "Use the selected question and keep the answer under 140 words.",
                contextForWindow(
                    windowId,
                    request.getContextMessageId(),
                    request.getQuestionId(),
                    task.generationLocale()
                ) + "\nReader answer: " + request.getContent()
            );

            AiMessageResponse response = AiMessageResponse.builder()
                .windowId(windowId)
                .role("assistant")
                .content(generated.text())
                .streamingReady(true)
                .aiModel(properties.getModel())
                .contextSnapshot(contextSnapshot(windowId, request.getContextMessageId()))
                .tokenUsage(generated.tokenUsage())
                .build();
            return AiGenerationResult.completed(
                response,
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.fromJson(generated.tokenUsage()),
                elapsedMillis(startedAt),
                "SUCCESS",
                false
            );
        } catch (RuntimeException exception) {
            logOpenAiFallback("window answer", exception);
            return AiGenerationResult.completed(
                fallback.answerWindowMessageWithMetadata(windowId, request, task).value(),
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                "FALLBACK",
                true
            );
        }
    }

    @Override
    public AiGenerationResult<AiMessageResponse> streamWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        Consumer<String> deltaConsumer,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        if (!configured()) {
            return fallback.streamWindowMessageWithMetadata(windowId, request, deltaConsumer, task);
        }
        AtomicBoolean emittedProviderDelta = new AtomicBoolean(false);
        try {
            GeneratedText generated = createTextStreamResult(
                task.generationLocale().languageInstruction() + " "
                    + READING_COMPANION_RULES
                    + "Use the selected question and keep the answer under 140 words.",
                contextForWindow(
                    windowId,
                    request.getContextMessageId(),
                    request.getQuestionId(),
                    task.generationLocale()
                )
                    + "\nReader answer: " + request.getContent(),
                delta -> {
                    emittedProviderDelta.set(true);
                    deltaConsumer.accept(delta);
                }
            );
            AiMessageResponse response = AiMessageResponse.builder()
                .windowId(windowId).role("assistant").content(generated.text())
                .streamingReady(true).aiModel(properties.getModel())
                .contextSnapshot(contextSnapshot(windowId, request.getContextMessageId()))
                .tokenUsage(generated.tokenUsage()).build();
            return AiGenerationResult.completed(
                response, task, "openai", properties.getModel(),
                AiTokenUsage.fromJson(generated.tokenUsage()), elapsedMillis(startedAt),
                "SUCCESS", false
            );
        } catch (RuntimeException exception) {
            if (emittedProviderDelta.get()) throw exception;
            logOpenAiFallback("window stream", exception);
            return fallback.streamWindowMessageWithMetadata(windowId, request, deltaConsumer, task);
        }
    }

    @Override
    public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
        Long windowId,
        DebateMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        if (!configured()) {
            return fallback.answerDebateMessageWithMetadata(windowId, request, task);
        }

        try {
            PersonaRecord persona = findPersonaForWindow(windowId, request.getPersonaId());
            String personaPrompt = personaContext(persona);
            GeneratedText generated = createTextResult(
                task.generationLocale().languageInstruction() + " " + READING_COMPANION_RULES + personaPrompt
                    + "\nChallenge or extend the reader's interpretation. Keep the answer under 140 words.",
                contextForWindow(
                    windowId,
                    request.getContextMessageId(),
                    null,
                    task.generationLocale()
                ) + "\nReader debate message: " + request.getContent()
            );

            AiMessageResponse response = AiMessageResponse.builder()
                .windowId(windowId)
                .role("assistant")
                .personaId(request.getPersonaId())
                .content(generated.text())
                .streamingReady(true)
                .aiModel(properties.getModel())
                .contextSnapshot(contextSnapshot(windowId, request.getContextMessageId()))
                .tokenUsage(generated.tokenUsage())
                .build();
            return AiGenerationResult.completed(
                response,
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.fromJson(generated.tokenUsage()),
                elapsedMillis(startedAt),
                "SUCCESS",
                false
            );
        } catch (RuntimeException exception) {
            logOpenAiFallback("debate answer", exception);
            return AiGenerationResult.completed(
                fallback.answerDebateMessageWithMetadata(windowId, request, task).value(),
                task,
                "openai",
                properties.getModel(),
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                "FALLBACK",
                true
            );
        }
    }

    @Override
    public AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
        Long windowId,
        List<DebateMessageRequest> requests,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        DebateBatchGeneration batch = generateDebateBatch(windowId, requests, task.generationLocale());
        AiTokenUsage usage = combinedTokenUsage(batch.responses());
        return AiGenerationResult.completed(
            batch.responses(),
            task,
            configured() ? "openai" : "placeholder",
            configured() ? properties.getModel() : "placeholder",
            usage,
            elapsedMillis(startedAt),
            batch.fallbackUsed() ? "FALLBACK" : "SUCCESS",
            batch.fallbackUsed()
        );
    }

    private DebateBatchGeneration generateDebateBatch(
        Long windowId,
        List<DebateMessageRequest> requests,
        GenerationLocale locale
    ) {
        if (!configured()) {
            List<AiMessageResponse> responses = requests == null
                ? List.of()
                : placeholderPersonaResponses(windowId, requests, locale);
            return new DebateBatchGeneration(responses, true);
        }
        if (requests == null || requests.isEmpty()) {
            return new DebateBatchGeneration(List.of(), false);
        }

        try {
            GeneratedText generated = createTextResult(
                locale.languageInstruction()
                    + " Return a JSON array of persona debate replies. Each object must include personaId and content. Match exactly the requested personaId values. Keep each content under 140 words.",
                contextForWindow(
                    windowId,
                    requests.get(0).getContextMessageId(),
                    null,
                    locale
                )
                    + "\nReader debate message: "
                    + safe(requests.get(0).getContent())
                    + "\nPersonas:\n"
                    + personaBatchPrompt(windowId, requests)
            );
            List<AiMessageResponse> parsedResponses = parseDebateResponses(windowId, requests, generated.text());
            String snapshot = contextSnapshot(windowId, requests.get(0).getContextMessageId());
            List<AiMessageResponse> responses = new ArrayList<>();
            for (int index = 0; index < parsedResponses.size(); index++) {
                responses.add(copyProviderMetadata(
                    parsedResponses.get(index),
                    snapshot,
                    index == 0 ? generated.tokenUsage() : null
                ));
            }
            if (responses.isEmpty()) {
                return new DebateBatchGeneration(
                    placeholderPersonaResponses(windowId, requests, locale),
                    true
                );
            }
            boolean partial = responses.size() < requests.size();
            List<AiMessageResponse> completed = fillMissingDebateResponses(
                windowId,
                requests,
                responses,
                locale
            );
            return new DebateBatchGeneration(
                completed,
                partial || completed.stream().anyMatch(this::isPlaceholderResponse)
            );
        } catch (RuntimeException exception) {
            logOpenAiFallback("debate batch answer", exception);
            return new DebateBatchGeneration(
                placeholderPersonaResponses(windowId, requests, locale),
                true
            );
        }
    }

    /** API 키가 없으면 의도적인 대체 후보 모드로 간주한다. */
    private boolean configured() {
        return properties.getApiKey() != null && !properties.getApiKey().isBlank();
    }


    private BookKnowledgeDto parseBookKnowledge(BookKnowledgeAnalyzeRequest request, String output) {
        try {
            JsonNode root = objectMapper.readTree(extractJsonObject(output));
            List<String> themes = readStringArray(root.path("themes"));
            List<String> quotes = readStringArray(root.path("famousQuotes"));
            List<String> keywords = readStringArray(root.path("keywords"));
            List<BookKnowledgeDto.DiscussionPointDto> points = new ArrayList<>();
            for (JsonNode point : root.path("discussionPoints")) {
                String id = text(point, "id", "dp-" + (points.size() + 1));
                points.add(BookKnowledgeDto.DiscussionPointDto.builder()
                    .id(id)
                    .question(text(point, "question", ""))
                    .rationale(text(point, "rationale", ""))
                    .recommendedPersonaKeys(readStringArray(point.path("recommendedPersonaKeys")))
                    .build());
            }
            List<BookKnowledgeDto.RecommendedPersonaDto> recommendedPersonas = new ArrayList<>();
            for (JsonNode recommendation : root.path("recommendedPersonas")) {
                recommendedPersonas.add(BookKnowledgeDto.RecommendedPersonaDto.builder()
                    .discussionPointId(text(recommendation, "discussionPointId", ""))
                    .personaKeys(readStringArray(recommendation.path("personaKeys")))
                    .build());
            }
            if (recommendedPersonas.isEmpty()) {
                recommendedPersonas = points.stream()
                    .map((point) -> BookKnowledgeDto.RecommendedPersonaDto.builder()
                        .discussionPointId(point.getId())
                        .personaKeys(point.getRecommendedPersonaKeys())
                        .build())
                    .toList();
            }
            return BookKnowledgeDto.builder()
                .title(request.getTitle())
                .author(request.getAuthor())
                .isbn(request.getIsbn())
                .summary(text(root, "summary", ""))
                .themes(themes)
                .discussionPoints(points)
                .recommendedPersonas(recommendedPersonas)
                .famousQuotes(quotes)
                .keywords(keywords)
                .version(text(root, "version", request.getPromptVersion()))
                .generationLocale(request.getGenerationLocale().value())
                .build();
        } catch (IOException exception) {
            throw new IllegalArgumentException("Book Knowledge JSON could not be parsed", exception);
        }
    }

    private String extractJsonObject(String output) {
        String safeOutput = safe(output);
        int start = safeOutput.indexOf('{');
        int end = safeOutput.lastIndexOf('}');
        if (start < 0 || end < start) {
            throw new IllegalArgumentException("Book Knowledge JSON object was not found");
        }
        return safeOutput.substring(start, end + 1);
    }

    private List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String value = item.asText("").trim();
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return values;
    }

    private String text(JsonNode node, String field, String fallbackValue) {
        String value = node.path(field).asText("").trim();
        return value.isBlank() ? fallbackValue : value;
    }

    /** OpenAI 응답 엔드포인트를 호출하고 정규화된 텍스트 출력을 반환한다. */
    private String createText(String instructions, String input) {
        return createTextResult(instructions, input).text();
    }

    private GeneratedText createTextResult(String instructions, String input) {
        return createTextResult(properties.getModel(), instructions, input);
    }

    private GeneratedText createTextResult(String model, String instructions, String input) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);
        root.put("max_output_tokens", properties.getMaxOutputTokens());
        root.put("store", false);
        ArrayNode messages = root.putArray("input");
        messages.add(message("developer", instructions));
        messages.add(message("user", input));

        var response = responsesTransport.execute(root);
        return new GeneratedText(
            response.outputText(),
            tokenUsage(response.tokenUsage())
        );
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - startedAt) / 1_000_000L);
    }

    private String tokenUsage(AiTokenUsage usage) {
        if (AiTokenUsage.NONE.equals(usage)) {
            return null;
        }
        return usage.toJson(objectMapper);
    }

    private String contextSnapshot(Long windowId, Long beforeMessageId) {
        List<MessageRecord> recent = messageMapper.findRecentByWindowBefore(windowId, beforeMessageId, 8);
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("windowId", windowId);
        ArrayNode sections = snapshot.putArray("sections");
        sections.add("system");
        sections.add("book");
        sections.add("persona");
        sections.add("conversation");
        ArrayNode messageIds = snapshot.putArray("recentMessageIds");
        recent.stream().map(MessageRecord::getId).filter(java.util.Objects::nonNull).forEach(messageIds::add);
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (IOException exception) {
            throw new IllegalStateException("AI context snapshot could not be serialized", exception);
        }
    }

    private AiMessageResponse copyProviderMetadata(AiMessageResponse response, String contextSnapshot, String tokenUsage) {
        return AiMessageResponse.builder()
            .windowId(response.getWindowId())
            .personaId(response.getPersonaId())
            .role(response.getRole())
            .content(response.getContent())
            .streamingReady(response.isStreamingReady())
            .aiModel(response.getAiModel())
            .contextSnapshot(contextSnapshot)
            .tokenUsage(tokenUsage)
            .build();
    }

    private AiTokenUsage combinedTokenUsage(List<AiMessageResponse> responses) {
        long inputTokens = 0;
        long cachedInputTokens = 0;
        long outputTokens = 0;
        long totalTokens = 0;
        for (AiMessageResponse response : responses) {
            AiTokenUsage usage = AiTokenUsage.fromJson(response.getTokenUsage());
            inputTokens += usage.inputTokens();
            cachedInputTokens += usage.cachedInputTokens();
            outputTokens += usage.outputTokens();
            totalTokens += usage.totalTokens();
        }
        return new AiTokenUsage(inputTokens, cachedInputTokens, outputTokens, totalTokens);
    }

    private boolean isPlaceholderResponse(AiMessageResponse response) {
        return response == null
            || response.getAiModel() == null
            || "placeholder".equalsIgnoreCase(response.getAiModel());
    }

    private record GeneratedText(String text, String tokenUsage) {
    }

    private record DebateBatchGeneration(
        List<AiMessageResponse> responses,
        boolean fallbackUsed
    ) {
    }

    /** 스트리밍 응답 엔드포인트를 호출하고 방출된 델타를 최종 텍스트로 모은다. */
    private GeneratedText createTextStreamResult(String instructions, String input, Consumer<String> deltaConsumer) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", properties.getModel());
        root.put("max_output_tokens", properties.getMaxOutputTokens());
        root.put("stream", true);
        root.put("store", false);
        ArrayNode messages = root.putArray("input");
        messages.add(message("developer", instructions));
        messages.add(message("user", input));

        var response = responsesTransport.executeStream(root, deltaConsumer);
        return new GeneratedText(
            response.outputText(),
            tokenUsage(response.tokenUsage())
        );
    }

    /** OpenAI 입력 메시지 노드 하나를 만든다. */
    private ObjectNode message(String role, String content) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("role", role);
        node.put("content", content);
        return node;
    }

    /** RAG 없이 쓰는 AI 프롬프트용 세션/윈도우/책/질문/메시지 context을 조립한다. */
    private String contextForWindow(
        Long windowId,
        Long beforeMessageId,
        Long selectedQuestionId,
        GenerationLocale generationLocale
    ) {
        SessionWindowContext context = sessionWindowMapper.findContextById(windowId);
        if (context == null) {
            return "No persisted session context is available.";
        }

        StringBuilder bookContext = new StringBuilder();
        StringBuilder readerContext = new StringBuilder();
        StringBuilder conversation = new StringBuilder();
        java.util.Map<Long, String> personaNames = personaMapper.findActiveForUser(context.getUserId()).stream()
            .collect(java.util.stream.Collectors.toMap(
                PersonaRecord::getId,
                PersonaRecord::getDisplayName,
                (left, right) -> left
            ));
        appendBookProfile(bookContext, context, generationLocale);
        appendReviewSummary(readerContext, context, generationLocale);

        SessionWindowRecord window = sessionWindowMapper.findById(windowId);
        if (window != null) {
            conversation.append("Window type: ").append(safe(window.getWindowType())).append('\n');
            conversation.append("Window title/topic: ").append(safe(window.getTitle())).append('\n');
        }
        if (context.getSourceQuestionId() != null) {
            conversation.append("Source reflection question:\n- ")
                .append(safe(context.getSourceQuestionText()))
                .append('\n');
            String savedAnswer = safe(context.getSourceQuestionAnswer()).trim();
            if (!savedAnswer.isBlank()) {
                conversation.append("Reader's saved answer:\n- ")
                    .append(truncate(savedAnswer, 1200))
                    .append('\n');
            }
        }

        conversation.append("Conversation rules:\n");
        conversation.append("- Connect to the reader's latest point before adding a new interpretation.\n");
        conversation.append("- Ground claims in persisted questions, messages, or explicit book metadata.\n");
        conversation.append("- Do not invent plot details or author intent when context is missing.\n");
        conversation.append("- Prefer Claim, Support, Question when it helps the discussion continue.\n");

        appendConversationSummary(
            conversation, windowId, beforeMessageId, context, personaNames, generationLocale
        );

        List<QuestionRecord> questions = selectedQuestionId == null
            ? List.of()
            : questionMapper.findByWindowId(windowId).stream()
                .filter(question -> selectedQuestionId.equals(question.getId()))
                .toList();
        if (!questions.isEmpty()) {
            conversation.append("Selected question:\n");
            questions.stream().limit(1).forEach((question) -> conversation
                .append("- #")
                .append(question.getId())
                .append(": ")
                .append(question.getQuestionText())
                .append('\n'));
        }

        List<MessageRecord> messages = new ArrayList<>(
            messageMapper.findRecentByWindowBefore(windowId, beforeMessageId, 8)
        );
        java.util.Collections.reverse(messages);
        if (!messages.isEmpty()) {
            conversation.append("Recent messages:\n");
            messages.stream().forEach((message) -> conversation
                .append("- ")
                .append(messageLabel(message, personaNames))
                .append(": ")
                .append(truncate(message.getContent(), 500))
                .append('\n'));
        }
        return new PromptContextPack(
            bookContext.toString(),
            readerContext.toString(),
            conversation.toString()
        ).render();
    }

    private void appendReviewSummary(
        StringBuilder builder,
        SessionWindowContext context,
        GenerationLocale locale
    ) {
        String content = safe(context.getReflectionContent()).trim();
        if (content.isBlank() || context.getReflectionInsightId() == null) {
            return;
        }
        String sourceHash = sha256(locale.value() + "|" + content);
        ReflectionSummaryRecord cached = reflectionSummaryMapper == null ? null
            : reflectionSummaryMapper.findByIdentity(context.getReflectionInsightId(), locale.value(), sourceHash);
        String summary = cached == null ? null : cached.getSummary();
        if (summary == null || summary.isBlank()) {
            try {
                GeneratedText generated = createTextResult(
                    properties.getModel(),
                    locale.languageInstruction()
                        + " Summarize this reader reflection in at most 120 words."
                        + " Preserve the reader's position, evidence, and unresolved question."
                        + " Do not add book facts.",
                    content
                );
                AiLanguageValidationOutcome validation = languageValidator.validate(locale, generated.text());
                if (validation == AiLanguageValidationOutcome.KNOWN_MISMATCH
                    || generated.text() == null || generated.text().isBlank()) {
                    appendRawReflection(builder, content);
                    return;
                }
                ReflectionSummaryRecord record = ReflectionSummaryRecord.builder()
                    .reflectionInsightId(context.getReflectionInsightId())
                    .generationLocale(locale.value())
                    .sourceHash(sourceHash)
                    .summary(generated.text())
                    .model(properties.getModel())
                    .tokenUsageJson(generated.tokenUsage())
                    .languageValidationOutcome(validation.name())
                    .testData(context.isTestData())
                    .build();
                if (reflectionSummaryMapper != null) {
                    reflectionSummaryMapper.insert(record);
                }
                summary = record.getSummary();
            } catch (RuntimeException exception) {
                logOpenAiFallback("reflection summary", exception);
                appendRawReflection(builder, content);
                return;
            }
        }
        builder.append("Reader review summary:\n- ").append(truncate(summary, 700)).append('\n');
    }

    private void appendRawReflection(StringBuilder builder, String content) {
        builder.append("Reader reflection:\n- ").append(truncate(content, 700)).append('\n');
    }

    private void appendConversationSummary(
        StringBuilder builder,
        Long windowId,
        Long beforeMessageId,
        SessionWindowContext context,
        java.util.Map<Long, String> personaNames,
        GenerationLocale locale
    ) {
        ObjectNode snapshot = parseObject(context.getWindowContextSnapshot());
        JsonNode stored = snapshot.path("conversationSummaries").path(locale.value());
        Long lastMessageId = stored.path("lastMessageId").isNumber()
            ? stored.path("lastMessageId").asLong()
            : null;
        String existing = stored.path("content").asText("");
        int summarizedMessageCount = stored.path("messageCount").asInt(0);
        List<MessageRecord> candidates = messageMapper.findSummaryCandidates(
            windowId, lastMessageId, beforeMessageId, 17
        );
        if (candidates.size() > 8) {
            List<MessageRecord> compacted = candidates.subList(0, candidates.size() - 8);
            StringBuilder source = new StringBuilder();
            if (!existing.isBlank()) {
                source.append("Previous summary:\n").append(existing).append("\nNew messages:\n");
            }
            compacted.forEach(message -> source
                .append(messageLabel(message, personaNames)).append(": ")
                .append(truncate(message.getContent(), 500)).append('\n'));
            GeneratedText generated;
            try {
                generated = createTextResult(
                    properties.getModel(),
                    locale.languageInstruction()
                        + " Update a compact conversation summary. Preserve the reader position,"
                        + " persona positions, agreements, conflicts, and unresolved questions."
                        + " Use at most 160 words. Do not invent facts.",
                    source.toString()
                );
                AiLanguageValidationOutcome validation = languageValidator.validate(locale, generated.text());
                if (generated.text() == null || generated.text().isBlank()
                    || validation == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
                    appendExistingConversationSummary(builder, existing);
                    return;
                }
            } catch (RuntimeException exception) {
                logOpenAiFallback("conversation summary", exception);
                appendExistingConversationSummary(builder, existing);
                return;
            }
            existing = generated.text();
            MessageRecord last = compacted.get(compacted.size() - 1);
            ObjectNode summary = objectMapper.createObjectNode();
            summary.put("content", existing);
            summary.put("lastMessageId", last.getId());
            summary.put("messageCount", summarizedMessageCount + compacted.size());
            summary.put("model", properties.getModel());
            if (generated.tokenUsage() != null) {
                summary.set("tokenUsage", parseObject(generated.tokenUsage()));
            }
            summary.put("updatedAt", java.time.Instant.now().toString());
            if (locale == GenerationLocale.KO) {
                sessionWindowMapper.updateConversationSummaryKo(windowId, writeJson(summary));
            } else {
                sessionWindowMapper.updateConversationSummaryEn(windowId, writeJson(summary));
            }
        }
        appendExistingConversationSummary(builder, existing);
    }

    private void appendExistingConversationSummary(StringBuilder builder, String existing) {
        if (!existing.isBlank()) {
            builder.append("Conversation summary:\n").append(truncate(existing, 900)).append('\n');
        }
    }

    private ObjectNode parseObject(String json) {
        if (json == null || json.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode parsed = objectMapper.readTree(json);
            return parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
        } catch (IOException exception) {
            return objectMapper.createObjectNode();
        }
    }

    private String writeJson(JsonNode value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (IOException exception) {
            throw new IllegalStateException("AI summary metadata could not be serialized", exception);
        }
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    /** 저장된 책 AI 프로필 메타데이터가 있으면 프롬프트 context에 추가한다. */
    private void appendBookProfile(
        StringBuilder builder,
        SessionWindowContext context,
        GenerationLocale generationLocale
    ) {
        if (context.getBookId() == null) {
            return;
        }
        builder.append("Book profile:\n");
        builder.append("- title: ").append(safe(context.getBookTitle())).append('\n');
        builder.append("- author: ").append(safe(context.getBookAuthor())).append('\n');
        if (context.getBookReadingStatus() != null) {
            builder.append("- readingStatus: ").append(context.getBookReadingStatus()).append('\n');
        }
        if (context.getBookRating() != null) {
            builder.append("- readerRating: ").append(context.getBookRating()).append('\n');
        }
        BookKnowledgeRecord knowledge = findReadyBookKnowledge(context, generationLocale);
        if (knowledge != null) {
            builder.append("- bookKnowledgeVersion: ").append(safe(knowledge.getPromptVersion())).append('\n');
            builder.append("- bookKnowledgeStale: ").append(bookKnowledgeStale(knowledge)).append('\n');
            builder.append("- bookKnowledgeFallback: ").append(knowledge.isFallbackUsed()).append('\n');
            builder.append("- bookKnowledgeSummary: ").append(truncate(knowledge.getSummary(), 700)).append('\n');
            appendJsonArrayText(builder, "themes", knowledge.getThemesJson(), 5);
            appendDiscussionPoints(builder, knowledge.getDiscussionPointsJson(), 3);
            appendJsonArrayText(builder, "keywords", knowledge.getKeywordsJson(), 8);
        } else if (context.getBookRawMetadata() != null && !context.getBookRawMetadata().isBlank()) {
            appendAiProfile(builder, context.getBookRawMetadata());
        }
    }

    private BookKnowledgeRecord findReadyBookKnowledge(
        SessionWindowContext context,
        GenerationLocale generationLocale
    ) {
        if (bookKnowledgeMapper == null) {
            return null;
        }
        String isbn = BookKnowledgeBusiness.normalizeIsbn(context.getBookIsbn());
        String lookupType = isbn == null ? "title_author" : "isbn";
        String lookupKey = isbn == null
            ? BookKnowledgeBusiness.normalizeIdentity(context.getBookTitle())
                + "|"
                + BookKnowledgeBusiness.normalizeIdentity(context.getBookAuthor())
            : isbn;
        return bookKnowledgeMapper.findReusableReadyByIdentity(
            lookupType,
            lookupKey,
            BookKnowledgeBusiness.PROMPT_VERSION,
            generationLocale.value(),
            bookKnowledgeFallbackDays()
        );
    }

    private boolean bookKnowledgeStale(BookKnowledgeRecord knowledge) {
        return knowledge.getGeneratedAt() == null
            || knowledge.getGeneratedAt().isBefore(
                java.time.LocalDateTime.now().minusDays(bookKnowledgeFreshDays())
            );
    }

    private int bookKnowledgeFreshDays() {
        return bookKnowledgeProperties == null
            ? 30
            : Math.max(1, bookKnowledgeProperties.getFreshDays());
    }

    private int bookKnowledgeFallbackDays() {
        return bookKnowledgeProperties == null
            ? 365
            : Math.max(bookKnowledgeFreshDays(), bookKnowledgeProperties.getFallbackDays());
    }

    private void appendJsonArrayText(StringBuilder builder, String label, String json, int limit) {
        try {
            appendProfileText(builder, label, objectMapper.readTree(safe(json)), limit);
        } catch (IOException exception) {
            log.debug("Book Knowledge {} could not be parsed for prompt context", label);
        }
    }

    private void appendDiscussionPoints(StringBuilder builder, String json, int limit) {
        try {
            JsonNode points = objectMapper.readTree(safe(json));
            if (!points.isArray()) {
                return;
            }
            List<String> questions = new ArrayList<>();
            for (int index = 0; index < Math.min(limit, points.size()); index++) {
                String question = points.get(index).path("question").asText("").trim();
                if (!question.isBlank()) {
                    questions.add(truncate(question, 240));
                }
            }
            if (!questions.isEmpty()) {
                builder.append("- discussionPoints: ").append(String.join(" | ", questions)).append('\n');
            }
        } catch (IOException exception) {
            log.debug("Book Knowledge discussion points could not be parsed for prompt context");
        }
    }

    /** 책 raw metadata 전체 대신 토론에 필요한 aiProfile 필드만 선택한다. */
    private void appendAiProfile(StringBuilder builder, String rawMetadata) {
        try {
            JsonNode profile = objectMapper.readTree(rawMetadata).path("aiProfile");
            appendProfileText(builder, "genre", profile.path("genre"), 5);
            appendProfileText(builder, "summary", profile.path("summaryShort"), 1);
            appendProfileText(builder, "themes", profile.path("themes"), 5);
            JsonNode characters = profile.has("characters") ? profile.path("characters") : profile.path("concepts");
            appendProfileText(builder, "charactersOrConcepts", characters, 5);
            appendProfileText(builder, "spoilerLevel", profile.path("spoilerLevel"), 1);
        } catch (IOException exception) {
            log.debug("Book aiProfile metadata could not be parsed for prompt context");
        }
    }

    private void appendProfileText(StringBuilder builder, String label, JsonNode value, int limit) {
        if (value == null || value.isMissingNode() || value.isNull()) {
            return;
        }
        String rendered;
        if (value.isArray()) {
            List<String> items = new ArrayList<>();
            for (int index = 0; index < Math.min(limit, value.size()); index++) {
                String item = value.get(index).asText("").trim();
                if (!item.isBlank()) {
                    items.add(item);
                }
            }
            rendered = String.join(", ", items);
        } else {
            rendered = truncate(value.asText(""), label.equals("summary") ? 600 : 160);
        }
        if (!rendered.isBlank()) {
            builder.append("- ").append(label).append(": ").append(rendered).append('\n');
        }
    }

    /** 메시지 이력 줄에 독자, persona, AI 역할 라벨을 붙인다. */
    private String messageLabel(MessageRecord message, java.util.Map<Long, String> personaNames) {
        if (message.getPersonaId() == null) {
            return safe(message.getRole());
        }
        String personaName = personaNames.getOrDefault(
            message.getPersonaId(), "persona#" + message.getPersonaId()
        );
        return safe(message.getRole()) + "(" + personaName + ")";
    }

    private String truncate(String value, int maxLength) {
        String safeValue = safe(value).replaceAll("\\s+", " ").trim();
        if (safeValue.length() <= maxLength) {
            return safeValue;
        }
        return safeValue.substring(0, maxLength - 3) + "...";
    }

    /** OpenAI 질문 JSON을 대상 윈도우의 질문 DTO로 파싱한다. */
    private List<QuestionDto> parseQuestions(Long windowId, String output) {
        List<QuestionDto> questions = new ArrayList<>();
        JsonNode root = parseJsonArray(output);
        for (int index = 0; index < root.size(); index++) {
            JsonNode item = root.get(index);
            String questionText = item.path("questionText").asText("");
            if (!questionText.isBlank()) {
                questions.add(QuestionDto.builder()
                    .windowId(windowId)
                    .questionText(questionText)
                    .questionType(item.path("questionType").asText("reflection"))
                    .status("active")
                    .aiModel(properties.getModel())
                    .build());
            }
        }
        return questions;
    }

    /** 요청된 persona 식별자들로 일괄 프롬프트 블록을 만든다. */
    private String personaBatchPrompt(Long windowId, List<DebateMessageRequest> requests) {
        StringBuilder builder = new StringBuilder();
        for (DebateMessageRequest request : requests) {
            PersonaRecord persona = findPersonaForWindow(windowId, request.getPersonaId());
            String personaPrompt = personaContext(persona);
            builder.append("- personaId: ")
                .append(request.getPersonaId())
                .append("\n  prompt: ")
                .append(personaPrompt)
                .append('\n');
        }
        return builder.toString();
    }

    private PersonaRecord findPersonaForWindow(Long windowId, Long personaId) {
        if (windowId == null) {
            return null;
        }
        SessionWindowContext context = sessionWindowMapper.findContextById(windowId);
        if (context == null || context.getUserId() == null) {
            return null;
        }
        return personaMapper.findActiveByIdForUser(personaId, context.getUserId());
    }

    private String personaContext(PersonaRecord persona) {
        if (persona == null) {
            return "Role: literary discussion participant";
        }
        String base = "Role: " + truncate(persona.getDisplayName(), 60)
            + "; Tone: " + truncate(persona.getTone(), 60)
            + "; Lens: " + truncate(persona.getDescription(), 140);
        if (persona.getName() != null && persona.getName().startsWith("reader-")) {
            return base + "; Instruction: " + truncate(persona.getSystemPrompt(), 200);
        }
        return base;
    }

    /** 일괄 persona 토론 JSON을 응답 DTO로 파싱한다. */
    private List<AiMessageResponse> parseDebateResponses(Long windowId, List<DebateMessageRequest> requests, String output) {
        java.util.Map<Long, DebateMessageRequest> requestByPersonaId = requests.stream()
            .collect(java.util.stream.Collectors.toMap(
                DebateMessageRequest::getPersonaId,
                (request) -> request,
                (left, right) -> left,
                java.util.LinkedHashMap::new
            ));
        java.util.Map<Long, String> contentByPersonaId = new java.util.LinkedHashMap<>();
        JsonNode root = parseJsonArray(output);
        for (JsonNode item : root) {
            Long personaId = item.path("personaId").canConvertToLong() ? item.path("personaId").asLong() : null;
            String content = item.path("content").asText("");
            if (personaId != null && requestByPersonaId.containsKey(personaId) && !content.isBlank()) {
                contentByPersonaId.put(personaId, content.trim());
            }
        }

        return requests.stream()
            .filter((request) -> contentByPersonaId.containsKey(request.getPersonaId()))
            .map((request) -> AiMessageResponse.builder()
                .windowId(windowId)
                .role("assistant")
                .personaId(request.getPersonaId())
                .content(contentByPersonaId.get(request.getPersonaId()))
                .streamingReady(true)
                .aiModel(properties.getModel())
                .build())
            .toList();
    }

    /** 누락된 persona 답변을 결정적 대체 응답으로 채운다. */
    private List<AiMessageResponse> fillMissingDebateResponses(
        Long windowId,
        List<DebateMessageRequest> requests,
        List<AiMessageResponse> responses,
        GenerationLocale locale
    ) {
        java.util.Map<Long, AiMessageResponse> responseByPersonaId = responses.stream()
            .filter((response) -> response.getPersonaId() != null)
            .collect(java.util.stream.Collectors.toMap(
                AiMessageResponse::getPersonaId,
                (response) -> response,
                (left, right) -> left,
                java.util.LinkedHashMap::new
            ));

        List<DebateMessageRequest> missingRequests = requests.stream()
            .filter((request) -> !responseByPersonaId.containsKey(request.getPersonaId()))
            .toList();
        if (!missingRequests.isEmpty()) {
            placeholderPersonaResponses(windowId, missingRequests, locale)
                .forEach((response) -> responseByPersonaId.putIfAbsent(response.getPersonaId(), response));
        }

        return requests.stream()
            .map((request) -> responseByPersonaId.get(request.getPersonaId()))
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    private List<AiMessageResponse> placeholderPersonaResponses(
        Long windowId,
        List<DebateMessageRequest> requests,
        GenerationLocale locale
    ) {
        AiGenerationTask task = new AiGenerationTask(
            "PERSONA", "persona-response-v1", "text-v1", locale
        );
        return requests.stream()
            .map(request -> fallback.answerDebateMessageWithMetadata(windowId, request, task).value())
            .toList();
    }

    /** 코드 블록이나 접두어가 붙은 JSON 텍스트도 허용해 모델 출력을 배열로 파싱한다. */
    private JsonNode parseJsonArray(String output) {
        try {
            String trimmed = output.trim();
            int start = trimmed.indexOf('[');
            int end = trimmed.lastIndexOf(']');
            if (start >= 0 && end > start) {
                trimmed = trimmed.substring(start, end + 1);
            }
            JsonNode node = objectMapper.readTree(trimmed);
            return node.isArray() ? node : objectMapper.createArrayNode();
        } catch (IOException exception) {
            return objectMapper.createArrayNode();
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    /** 프롬프트나 응답 내용을 남기지 않고 대체 응답 원인만 기록한다. */
    private void logOpenAiFallback(String operation, RuntimeException exception) {
        log.warn(
            "OpenAI {} failed; using local fallback. model={}, baseUrl={}, reason={}",
            operation,
            properties.getModel(),
            properties.getBaseUrl(),
            exception.getMessage()
        );
    }

}
