package com.margins.reflectionloop.ai;

import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
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
    private final AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();

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
        List<String> previousAnswers,
        GenerationLocale locale
    ) {
        return generate(
            windowId, reflection, coverageArea, bookOnly, previousQuestions, previousAnswers,
            List.of(), null, "reflection-interview-v1", "SIMPLE", false, locale
        );
    }

    public QuestionDraft generate(
        Long windowId, String reflection, String coverageArea, boolean bookOnly,
        List<String> previousQuestions, List<String> previousAnswers,
        List<EvidenceDraft> evidence, String primarySourceAlias, String promptVersion,
        String depth, boolean testData, GenerationLocale locale
    ) {
        if (previousQuestions == null || previousQuestions.isEmpty()) {
            return new QuestionDraft(
                fallbackQuestion("FIRST_IMPRESSION", bookOnly, locale),
                "reflection-loop-deterministic",
                locale.value(),
                AiLanguageValidationOutcome.UNKNOWN.name()
            );
        }
        String focus = promptFocus(
            reflection, coverageArea, bookOnly, previousQuestions, previousAnswers,
            evidence, primarySourceAlias, locale
        );
        GenerateQuestionsRequest providerRequest =
            GenerateQuestionsRequest.builder().count(1).focus(focus).build();
        AiGenerationTask task = new AiGenerationTask(
            "INTERVIEW",
            promptVersion,
            "question-list-v1",
            locale
        );
        AiGenerationResult<QuestionListResponse> generation =
            metadataGeneration(windowId, providerRequest, task);
        if (generation == null) {
            generation = AiGenerationResult.failure(task, "unknown", "unknown", 0);
        }
        QuestionListResponse response = generation == null ? null : generation.value();
        List<QuestionDto> suggestions = response == null || response.getQuestions() == null
            ? List.of()
            : response.getQuestions();
        QuestionDto suggestion = suggestions == null || suggestions.isEmpty() ? null : suggestions.get(0);
        boolean ordinaryFallback = generation != null
            && generation.fallbackUsed()
            && generation.languageValidationOutcome() == null;
        AiLanguageValidationOutcome validation = ordinaryFallback
            ? null
            : suggestion == null
                ? AiLanguageValidationOutcome.UNKNOWN
                : languageValidator.validate(locale, suggestion.getQuestionText());
        if (validation == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
            suggestion = null;
            generation = generation.withOutcome("FALLBACK", true).withLanguageValidation(validation);
        } else if (generation != null && validation != null) {
            generation = generation.withLanguageValidation(validation);
        }
        if (suggestion == null && generation != null) {
            generation = generation.withOutcome("FALLBACK", true);
        }
        generationObserver.observe(generation, depth, testData);
        String question = suggestion == null
            || suggestion.getQuestionText() == null
            || suggestion.getQuestionText().isBlank()
            ? fallbackQuestion(coverageArea, bookOnly, locale)
            : suggestion.getQuestionText().trim();
        return new QuestionDraft(
            question,
            suggestion == null
                ? "reflection-loop-fallback"
                : generation == null
                    || generation.fallbackUsed()
                    || "unknown".equals(generation.model())
                    ? suggestion.getAiModel()
                    : generation.model(),
            locale.value(),
            validation == null ? null : validation.name()
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

    private String promptFocus(
        String reflection,
        String coverageArea,
        boolean bookOnly,
        List<String> previousQuestions,
        List<String> previousAnswers,
        List<EvidenceDraft> evidence,
        String primarySourceAlias,
        GenerationLocale locale
    ) {
        if (locale == GenerationLocale.EN) {
            return """
                Current Reflection: %s
                Current coverage area: %s
                Response constraint: %s
                Generate exactly one question that does not repeat a previous question.
                Primary evidence alias for this question: %s
                Available bounded evidence: %s
                Previous questions: %s
                Previous answers: %s
                """.formatted(
                truncate(reflection, 1200),
                coverageArea,
                bookOnly
                    ? "Ask only about scenes, claims, or evidence in the book; do not ask about personal experience."
                    : "Do not pressure the reader to disclose private information.",
                primarySourceAlias == null ? "R1" : primarySourceAlias,
                evidenceText(evidence),
                String.join(" | ", previousQuestions),
                String.join(" | ", previousAnswers.stream().map(answer -> truncate(answer, 500)).toList())
            );
        }
        return """
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
    }

    private String fallbackQuestion(String coverageArea, boolean bookOnly, GenerationLocale locale) {
        if (locale == GenerationLocale.EN) {
            if (bookOnly) return "Which scene or claim in the book could help you revisit this thought?";
            return switch (coverageArea) {
                case "FIRST_IMPRESSION" -> "Which scene or sentence first led you to write this reflection?";
                case "TEXTUAL_INTERPRETATION" -> "What evidence in the book supports that interpretation?";
                case "PERSONAL_RESPONSE" -> "Without sharing anything private, what feeling or question stayed with you longest?";
                case "ALTERNATIVE_VIEW" -> "What different interpretation becomes possible from the opposite point of view?";
                case "SOCIAL_VALUE" -> "How does the book's concern connect with society or community today?";
                default -> "Which part of this reflection would you most like to explore further?";
            };
        }
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

    public record QuestionDraft(
        String question,
        String model,
        String generationLocale,
        String languageValidationOutcome
    ) {
        public QuestionDraft(String question, String model) {
            this(question, model, null, null);
        }
    }

    public record EvidenceDraft(String alias, String type, String excerpt) {
    }
}
