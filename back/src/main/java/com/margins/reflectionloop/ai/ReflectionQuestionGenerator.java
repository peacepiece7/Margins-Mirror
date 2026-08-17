package com.margins.reflectionloop.ai;

import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReflectionQuestionGenerator {
    private final AiProvider aiProvider;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    public QuestionDraft generate(
        Long windowId,
        String reflection,
        String coverageArea,
        boolean bookOnly,
        List<String> previousQuestions,
        List<String> previousAnswers
    ) {
        return generate(
            windowId,
            reflection,
            coverageArea,
            bookOnly,
            previousQuestions,
            previousAnswers,
            "reflection-interview-v1",
            "SIMPLE",
            false
        );
    }

    public QuestionDraft generate(
        Long windowId,
        String reflection,
        String coverageArea,
        boolean bookOnly,
        List<String> previousQuestions,
        List<String> previousAnswers,
        String promptVersion,
        String depth,
        boolean testData
    ) {
        return generate(
            windowId,
            reflection,
            coverageArea,
            bookOnly,
            previousQuestions,
            previousAnswers,
            List.of(),
            null,
            promptVersion,
            depth,
            testData
        );
    }

    public QuestionDraft generate(
        Long windowId,
        String reflection,
        String coverageArea,
        boolean bookOnly,
        List<String> previousQuestions,
        List<String> previousAnswers,
        List<EvidenceDraft> evidence,
        String primarySourceAlias,
        String promptVersion,
        String depth,
        boolean testData
    ) {
        if (previousQuestions == null || previousQuestions.isEmpty()) {
            return new QuestionDraft(
                "이 책을 덮고 난 뒤 가장 먼저 남은 장면이나 문장은 무엇이며, 왜 그것이 지금의 생각으로 이어졌나요?",
                "reflection-loop-deterministic"
            );
        }
        String focus = """
            현재 Reflection: %s
            이번 coverage: %s
            응답 선호: %s
            이전 질문과 겹치지 않게 질문 한 개만 생성하세요.
            이번 질문의 주 근거 alias: %s
            사용할 수 있는 bounded 근거: %s
            이전 질문: %s
            이전 답변: %s
            """.formatted(
            truncate(reflection, 1200),
            coverageArea,
            bookOnly ? "개인 경험을 묻지 말고 책의 장면·주장·근거만 질문" : "개인 정보 공개를 강요하지 않기",
            primarySourceAlias == null ? "R1" : primarySourceAlias,
            evidenceText(evidence),
            String.join(" | ", previousQuestions),
            String.join(" | ", previousAnswers.stream().map(answer -> truncate(answer, 500)).toList())
        );
        GenerateQuestionsRequest providerRequest =
            GenerateQuestionsRequest.builder().count(1).focus(focus).build();
        AiGenerationTask task = new AiGenerationTask(
            "INTERVIEW",
            promptVersion,
            "question-list-v1"
        );
        AiGenerationResult<QuestionListResponse> generation =
            metadataGeneration(windowId, providerRequest, task);
        if (generation == null) {
            generation = legacyGeneration(windowId, providerRequest, task);
        }
        QuestionListResponse response = generation == null ? null : generation.value();
        List<QuestionDto> suggestions = response == null || response.getQuestions() == null
            ? List.of()
            : response.getQuestions();
        QuestionDto suggestion = suggestions == null || suggestions.isEmpty() ? null : suggestions.get(0);
        if (suggestion == null && generation != null) {
            generation = generation.withOutcome("FALLBACK", true);
        }
        generationObserver.observe(generation, depth, testData);
        String question = suggestion == null
            || suggestion.getQuestionText() == null
            || suggestion.getQuestionText().isBlank()
            ? fallbackQuestion(coverageArea, bookOnly)
            : suggestion.getQuestionText().trim();
        return new QuestionDraft(
            question,
            suggestion == null
                ? "reflection-loop-fallback"
                : generation == null
                    || generation.fallbackUsed()
                    || "unknown".equals(generation.model())
                    ? suggestion.getAiModel()
                    : generation.model()
        );
    }

    private String evidenceText(List<EvidenceDraft> evidence) {
        if (evidence == null || evidence.isEmpty()) {
            return "R1 [REFLECTION]: current Reflection";
        }
        return evidence.stream()
            .limit(12)
            .map(source -> source.alias()
                + " ["
                + source.type()
                + "]: "
                + truncate(source.excerpt(), 500))
            .collect(java.util.stream.Collectors.joining(" | "));
    }

    private String fallbackQuestion(String coverageArea, boolean bookOnly) {
        if (bookOnly) {
            return "이 생각을 다시 살펴볼 수 있는 책 속 장면이나 주장은 무엇인가요?";
        }
        return switch (coverageArea) {
            case "FIRST_IMPRESSION" -> "처음 이 생각을 적게 만든 장면이나 문장은 무엇이었나요?";
            case "TEXTUAL_INTERPRETATION" -> "그 장면을 그렇게 해석하게 한 책 속 근거는 무엇인가요?";
            case "PERSONAL_RESPONSE" -> "개인 경험을 말하지 않아도 괜찮습니다. 이 대목에서 가장 오래 남은 감정이나 질문은 무엇인가요?";
            case "ALTERNATIVE_VIEW" -> "같은 장면을 반대 관점에서 본다면 어떤 해석이 가능할까요?";
            case "SOCIAL_VALUE" -> "이 책의 문제의식은 지금의 사회나 공동체와 어떻게 이어지나요?";
            default -> "지금의 Reflection에서 토론을 통해 가장 더 깊게 보고 싶은 한 지점은 무엇인가요?";
        };
    }

    private String truncate(String value, int max) {
        String safe = value == null ? "" : value.trim();
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    private AiGenerationResult<QuestionListResponse> legacyGeneration(
        Long windowId,
        GenerateQuestionsRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            QuestionListResponse response = aiProvider.suggestQuestions(windowId, request);
            QuestionDto first = response == null || response.getQuestions() == null
                ? null
                : response.getQuestions().stream()
                    .filter(java.util.Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            String model = first == null ? "unknown" : first.getAiModel();
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

    private AiGenerationResult<QuestionListResponse> metadataGeneration(
        Long windowId,
        GenerateQuestionsRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            return aiProvider.suggestQuestionsWithMetadata(windowId, request, task);
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }

    public record QuestionDraft(String question, String model) {
    }

    public record EvidenceDraft(String alias, String type, String excerpt) {
    }
}
