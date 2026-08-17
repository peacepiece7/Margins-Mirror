package com.margins.ai;

import com.margins.book.dto.BookKnowledgeAnalyzeRequest;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.ai.DiscussionGuideGeneration.Evidence;
import com.margins.ai.DiscussionGuideGeneration.Item;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.DiscussionGuideGeneration.Response;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionListResponse;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import java.util.List;
import java.util.function.Consumer;

public interface AiProvider {
    default BookKnowledgeDto analyzeBookKnowledge(BookKnowledgeAnalyzeRequest request) {
        String title = request.getTitle() == null || request.getTitle().isBlank() ? "이 책" : request.getTitle().trim();
        String firstPointId = "dp-001";
        String secondPointId = "dp-002";
        return BookKnowledgeDto.builder()
            .title(title)
            .author(request.getAuthor())
            .isbn(request.getIsbn())
            .summary(title + "의 핵심 맥락을 토론 준비용으로 요약한 임시 Book Knowledge입니다. 주요 인물, 사건, 주제는 독자의 해석을 열어 두는 방향으로 다루며, 실제 토론에서는 사용자의 기록과 함께 보완해서 사용합니다.")
            .themes(List.of("성장", "해석", "관계"))
            .discussionPoints(List.of(
                BookKnowledgeDto.DiscussionPointDto.builder()
                    .id(firstPointId)
                    .question(title + "에서 가장 다르게 해석될 수 있는 선택은 무엇인가?")
                    .rationale("정답을 정하지 않고 독자의 관점과 근거를 끌어낼 수 있다.")
                    .recommendedPersonaKeys(List.of("psychological-counselor", "university-professor"))
                    .build(),
                BookKnowledgeDto.DiscussionPointDto.builder()
                    .id(secondPointId)
                    .question("이 책의 핵심 주제는 오늘의 삶과 어떻게 연결되는가?")
                    .rationale("책의 의미를 현재의 문제의식과 연결할 수 있다.")
                    .recommendedPersonaKeys(List.of("journalist", "writer"))
                    .build()
            ))
            .recommendedPersonas(List.of(
                BookKnowledgeDto.RecommendedPersonaDto.builder()
                    .discussionPointId(firstPointId)
                    .personaKeys(List.of("psychological-counselor", "university-professor"))
                    .build(),
                BookKnowledgeDto.RecommendedPersonaDto.builder()
                    .discussionPointId(secondPointId)
                    .personaKeys(List.of("journalist", "writer"))
                    .build()
            ))
            .famousQuotes(List.of())
            .keywords(List.of("독서", "토론", "관점"))
            .version(request.getPromptVersion())
            .build();
    }

    default AiGenerationResult<BookKnowledgeDto> analyzeBookKnowledgeWithMetadata(
        BookKnowledgeAnalyzeRequest request
    ) {
        long startedAt = System.nanoTime();
        AiGenerationTask task = new AiGenerationTask(
            "BOOK_KNOWLEDGE",
            request.getPromptVersion(),
            "book-knowledge-schema-v1"
        );
        try {
            return AiGenerationResult.completed(
                analyzeBookKnowledge(request),
                task,
                "placeholder",
                "placeholder",
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                "FALLBACK",
                true
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(
                task,
                "placeholder",
                "placeholder",
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                "TRANSPORT"
            );
        }
    }

    QuestionListResponse suggestQuestions(Long windowId, GenerateQuestionsRequest request);

    default AiGenerationResult<QuestionListResponse> suggestQuestionsWithMetadata(
        Long windowId,
        GenerateQuestionsRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            QuestionListResponse response = suggestQuestions(windowId, request);
            String model = response == null || response.getQuestions() == null
                ? "unknown"
                : response.getQuestions().stream()
                    .filter(java.util.Objects::nonNull)
                    .map(com.margins.question.dto.QuestionDto::getAiModel)
                    .filter(value -> value != null && !value.isBlank())
                    .findFirst()
                    .orElse("unknown");
            boolean fallbackUsed = "placeholder".equalsIgnoreCase(model);
            return AiGenerationResult.completed(
                response,
                task,
                fallbackUsed ? "placeholder" : "unknown",
                model,
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                fallbackUsed ? "FALLBACK" : "SUCCESS",
                fallbackUsed
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    default Response generateDiscussionGuide(Request request) {
        List<Evidence> evidence = request.evidence() == null ? List.of() : request.evidence();
        if (evidence.isEmpty()) {
            throw new IllegalArgumentException("Discussion Guide evidence is required");
        }
        Evidence reflection = evidence.get(0);
        Evidence answer = evidence.size() > 1 ? evidence.get(1) : reflection;
        String reflectionExcerpt = compact(reflection.excerpt(), 180);
        String answerIssue = "ANSWER".equals(answer.type())
            ? "비공개 답변에서 드러난 관점 차이를 질문으로 검토합니다."
            : "Reflection에서 드러난 다른 가능성: " + compact(answer.excerpt(), 180);
        return new Response(
            guideGoal(request.purpose(), request.audienceMode(), request.targetMinutes()),
            List.of(
                "처음 Reflection의 핵심 근거: " + reflectionExcerpt,
                answerIssue
            ),
            List.of(
                item("WARM_UP", "이 책을 덮고 가장 먼저 남은 장면이나 문장은 무엇인가요?",
                    "부담 없이 대화의 공통 출발점을 찾습니다.", reflection.alias(), "LOW", 5,
                    "그 장면을 한 문장으로 더 구체화한다면 어떻게 말할 수 있을까요?"),
                item("INTERPRETATION", "현재 해석을 가장 잘 뒷받침하거나 흔드는 본문 근거는 무엇인가요?",
                    "해석과 텍스트 근거의 연결을 확인합니다.", answer.alias(), "LOW", 8,
                    "반대 근거가 있다면 어느 대목인가요?"),
                item("EXPERIENCE", "개인 경험을 말하지 않아도 괜찮습니다. 책 속 선택이 독자에게 요구하는 것은 무엇일까요?",
                    "개인 공개를 강요하지 않고 의미의 접점을 넓힙니다.", reflection.alias(), "MEDIUM", 8,
                    "책 속 인물이나 주장만 놓고 답한다면 어떻게 달라지나요?"),
                item("SOCIAL_VALUE", "이 책의 문제의식을 오늘의 사회에 놓으면 어떤 질문이 새로 생기나요?",
                    "책의 문제의식을 다른 맥락과 가치로 확장합니다.", answer.alias(), "LOW", 8,
                    "그 연결에서 가장 경계해야 할 단순화는 무엇인가요?"),
                item("CLOSING", "대화를 거친 지금, 처음 Reflection에서 유지하거나 바꾸고 싶은 한 문장은 무엇인가요?",
                    "대화 뒤 남은 생각과 질문을 독자의 언어로 정리합니다.", reflection.alias(), "LOW", 5,
                    "지금의 결론에 남아 있는 질문은 무엇인가요?")
            ),
            "placeholder",
            "placeholder",
            null,
            0,
            "FALLBACK",
            true
        );
    }

    private static String guideGoal(String purpose, String audienceMode, int targetMinutes) {
        String purposeLabel = switch (purpose) {
            case "ISSUE_EXPLORATION" -> "핵심 쟁점과 대안 관점을 탐색";
            case "DISCUSSION_PREP" -> "함께 이야기할 논점과 진행 흐름을 준비";
            default -> "처음 생각의 근거와 대안 관점을 확인";
        };
        String audienceLabel = "SMALL_GROUP".equals(audienceMode) ? "소그룹" : "AI와의 자기 대화";
        return purposeLabel + "하고 " + audienceLabel + "에서 " + targetMinutes
            + "분 동안 독자의 언어로 다시 정리합니다.";
    }

    default AiGenerationResult<Response> generateDiscussionGuideWithMetadata(Request request) {
        long startedAt = System.nanoTime();
        AiGenerationTask task = new AiGenerationTask(
            "DISCUSSION_GUIDE",
            request.promptVersion(),
            request.schemaVersion()
        );
        try {
            Response response = generateDiscussionGuide(request);
            if (response == null) {
                return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
            }
            return AiGenerationResult.completed(
                response,
                task,
                response.provider(),
                response.model(),
                AiTokenUsage.fromJson(response.tokenUsage()),
                Math.max(response.latencyMs(), elapsedMillis(startedAt)),
                response.outcome(),
                response.fallbackUsed()
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    AiMessageResponse answerWindowMessage(Long windowId, SendMessageRequest request);

    default AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            AiMessageResponse response = answerWindowMessage(windowId, request);
            return messageResult(response, task, elapsedMillis(startedAt));
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    default AiMessageResponse streamWindowMessage(Long windowId, SendMessageRequest request, Consumer<String> deltaConsumer) {
        AiMessageResponse response = answerWindowMessage(windowId, request);
        chunks(response.getContent()).forEach(deltaConsumer);
        return response;
    }

    AiMessageResponse answerDebateMessage(Long windowId, DebateMessageRequest request);

    default AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
        Long windowId,
        DebateMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            AiMessageResponse response = answerDebateMessage(windowId, request);
            return messageResult(response, task, elapsedMillis(startedAt));
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    default List<AiMessageResponse> answerDebateMessages(Long windowId, List<DebateMessageRequest> requests) {
        return requests.stream()
            .map((request) -> answerDebateMessage(windowId, request))
            .toList();
    }

    default AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
        Long windowId,
        List<DebateMessageRequest> requests,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            List<AiMessageResponse> responses = answerDebateMessages(windowId, requests);
            AiMessageResponse metadata = responses == null
                ? null
                : responses.stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
            AiGenerationResult<AiMessageResponse> message = messageResult(
                metadata,
                task,
                elapsedMillis(startedAt)
            );
            return new AiGenerationResult<>(
                responses,
                message.taskType(),
                message.provider(),
                message.model(),
                message.promptVersion(),
                message.schemaVersion(),
                message.inputTokens(),
                message.cachedInputTokens(),
                message.outputTokens(),
                message.latencyMs(),
                message.outcome(),
                message.fallbackUsed(),
                message.failureCategory()
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    private Iterable<String> chunks(String content) {
        String safeContent = content == null ? "" : content;
        int chunkSize = 24;
        java.util.Map<Integer, String> result = new java.util.LinkedHashMap<>();
        for (int start = 0; start < safeContent.length(); start += chunkSize) {
            int end = Math.min(start + chunkSize, safeContent.length());
            result.put(start, safeContent.substring(start, end));
        }
        if (result.isEmpty()) {
            result.put(0, "");
        }
        return result.values();
    }

    private static Item item(
        String stage,
        String question,
        String intent,
        String sourceAlias,
        String sensitivity,
        int expectedMinutes,
        String followUp
    ) {
        return new Item(
            stage,
            "REQUIRED",
            question,
            intent,
            sourceAlias,
            sensitivity,
            true,
            expectedMinutes,
            List.of(followUp)
        );
    }

    private static String compact(String value, int max) {
        String safe = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        if (safe.isBlank()) {
            return "저장된 독서 기록";
        }
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    private static AiGenerationResult<AiMessageResponse> messageResult(
        AiMessageResponse response,
        AiGenerationTask task,
        int latencyMs
    ) {
        if (response == null) {
            return AiGenerationResult.failure(task, "unknown", "unknown", latencyMs);
        }
        String model = response.getAiModel();
        boolean fallbackUsed = model == null
            || model.isBlank()
            || "placeholder".equalsIgnoreCase(model);
        return AiGenerationResult.completed(
            response,
            task,
            fallbackUsed ? "placeholder" : "openai",
            model,
            AiTokenUsage.fromJson(response.getTokenUsage()),
            latencyMs,
            fallbackUsed ? "FALLBACK" : "SUCCESS",
            fallbackUsed
        );
    }

    private static int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }
}
