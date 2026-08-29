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
    default BookKnowledgeDto fallbackBookKnowledge(BookKnowledgeAnalyzeRequest request) {
        boolean korean = request.getGenerationLocale() == GenerationLocale.KO;
        String title = request.getTitle() == null || request.getTitle().isBlank()
            ? korean ? "이 책" : "This book"
            : request.getTitle().trim();
        String firstPointId = "dp-001";
        String secondPointId = "dp-002";
        return BookKnowledgeDto.builder()
            .title(title)
            .author(request.getAuthor())
            .isbn(request.getIsbn())
            .summary(korean
                ? title + "의 핵심 맥락을 토론 준비용으로 요약한 임시 Book Knowledge입니다. 주요 인물, 사건, 주제는 독자의 해석을 열어 두는 방향으로 다루며, 실제 토론에서는 사용자의 기록과 함께 보완해서 사용합니다."
                : "This temporary Book Knowledge summarizes " + title + " for a reading discussion. It keeps characters, events, and themes open to interpretation and should be combined with the reader's own notes during discussion.")
            .themes(korean ? List.of("성장", "해석", "관계") : List.of("growth", "interpretation", "relationships"))
            .discussionPoints(List.of(
                BookKnowledgeDto.DiscussionPointDto.builder()
                    .id(firstPointId)
                    .question(korean ? title + "에서 가장 다르게 해석될 수 있는 선택은 무엇인가?" : "Which choice in " + title + " allows for the widest range of interpretations?")
                    .rationale(korean ? "정답을 정하지 않고 독자의 관점과 근거를 끌어낼 수 있다." : "It invites the reader to support a viewpoint without assuming one correct answer.")
                    .recommendedPersonaKeys(List.of("psychological-counselor", "university-professor"))
                    .build(),
                BookKnowledgeDto.DiscussionPointDto.builder()
                    .id(secondPointId)
                    .question(korean ? "이 책의 핵심 주제는 오늘의 삶과 어떻게 연결되는가?" : "How does the book's central theme connect with life today?")
                    .rationale(korean ? "책의 의미를 현재의 문제의식과 연결할 수 있다." : "It connects the book's meaning with questions that matter now.")
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
            .keywords(korean ? List.of("독서", "토론", "관점") : List.of("reading", "discussion", "perspective"))
            .version(request.getPromptVersion())
            .generationLocale(request.getGenerationLocale().value())
            .build();
    }

    default AiGenerationResult<BookKnowledgeDto> analyzeBookKnowledgeWithMetadata(
        BookKnowledgeAnalyzeRequest request
    ) {
        long startedAt = System.nanoTime();
        AiGenerationTask task = new AiGenerationTask(
            "BOOK_KNOWLEDGE",
            request.getPromptVersion(),
            "book-knowledge-schema-v1",
            request.getGenerationLocale()
        );
        try {
            return AiGenerationResult.completed(
                fallbackBookKnowledge(request),
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

    AiGenerationResult<QuestionListResponse> suggestQuestionsWithMetadata(
        Long windowId,
        GenerateQuestionsRequest request,
        AiGenerationTask task
    );

    default Response generateDiscussionGuide(Request request) {
        List<Evidence> evidence = request.evidence() == null ? List.of() : request.evidence();
        if (evidence.isEmpty()) {
            throw new IllegalArgumentException("Discussion Guide evidence is required");
        }
        Evidence reflection = evidence.get(0);
        Evidence answer = evidence.size() > 1 ? evidence.get(1) : reflection;
        if (request.generationLocale() == GenerationLocale.EN) {
            return new Response(
                "Explore the reader's interpretation and test it against evidence during the discussion.",
                List.of(
                    "Examine the strongest evidence behind the initial reflection.",
                    "Consider a meaningful alternative interpretation of the same evidence."
                ),
                List.of(
                    item("WARM_UP", "Which scene or sentence stayed with you first after closing the book?",
                        "Establish a comfortable shared starting point for the discussion.", reflection.alias(), "LOW", 5,
                        "How would you describe that moment in one more sentence?"),
                    item("INTERPRETATION", "Which textual evidence most supports or challenges your current interpretation?",
                        "Connect the interpretation to specific evidence from the text.", answer.alias(), "LOW", 8,
                        "What passage could support the opposite interpretation?"),
                    item("EXPERIENCE", "Without sharing anything private, what does this choice ask of a reader?",
                        "Expand the meaning without requiring personal disclosure.", reflection.alias(), "MEDIUM", 8,
                        "How would the answer change if we considered only the character's choice?"),
                    item("SOCIAL_VALUE", "What new question appears when the book's concern is placed in today's society?",
                        "Connect the book's concern with another context or value.", answer.alias(), "LOW", 8,
                        "Which simplification should we be most careful to avoid?"),
                    item("CLOSING", "After this discussion, which sentence from your first reflection would you keep or revise?",
                        "Summarize the remaining thought in the reader's own words.", reflection.alias(), "LOW", 5,
                        "What question remains unresolved for you now?")
                ),
                "placeholder", "placeholder", null, 0, "FALLBACK", true
            );
        }
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
            request.schemaVersion(),
            request.generationLocale()
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

    AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    );

    AiGenerationResult<AiMessageResponse> streamWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        Consumer<String> deltaConsumer,
        AiGenerationTask task
    );

    AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
        Long windowId,
        DebateMessageRequest request,
        AiGenerationTask task
    );

    default AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
        Long windowId,
        List<DebateMessageRequest> requests,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            List<AiGenerationResult<AiMessageResponse>> itemResults = requests == null
                ? List.of()
                : requests.stream()
                    .map(request -> answerDebateMessageWithMetadata(windowId, request, task))
                    .toList();
            List<AiMessageResponse> responses = itemResults.stream()
                .map(result -> result == null ? null : result.value())
                .toList();
            AiMessageResponse metadata = responses == null
                ? null
                : responses.stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
            AiGenerationResult<AiMessageResponse> message = itemResults.stream()
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElseGet(() -> messageResult(metadata, task, elapsedMillis(startedAt)));
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
                message.failureCategory(),
                message.generationLocale(),
                message.languageValidationOutcome()
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
