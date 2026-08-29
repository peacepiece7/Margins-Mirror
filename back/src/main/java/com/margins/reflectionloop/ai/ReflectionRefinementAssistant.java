package com.margins.reflectionloop.ai;

import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.AiProvider;
import com.margins.ai.GenerationLocale;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.SendMessageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReflectionRefinementAssistant {
    private final AiProvider aiProvider;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;
    private AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    @Autowired
    void configureLanguageValidator(AiOutputLanguageValidator languageValidator) {
        this.languageValidator = languageValidator;
    }

    public String suggest(Long windowId, String currentReflection, String perspectiveSummary) {
        return suggest(
            windowId,
            currentReflection,
            perspectiveSummary,
            "reflection-refinement-v1",
            null,
            false,
            GenerationLocale.KO
        );
    }

    public String suggest(
        Long windowId,
        String currentReflection,
        String perspectiveSummary,
        String promptVersion,
        String depth,
        boolean testData
    ) {
        return suggest(
            windowId, currentReflection, perspectiveSummary, promptVersion, depth, testData,
            GenerationLocale.KO
        );
    }

    public String suggest(
        Long windowId,
        String currentReflection,
        String perspectiveSummary,
        String promptVersion,
        String depth,
        boolean testData,
        GenerationLocale locale
    ) {
        AiGenerationResult<String> generation = suggestWithMetadata(
            windowId, currentReflection, perspectiveSummary, promptVersion, depth, testData, locale
        );
        if (generation.value() == null) {
            throw new IllegalStateException("Reflection refinement could not be generated");
        }
        return generation.value();
    }

    public AiGenerationResult<String> suggestWithMetadata(
        Long windowId,
        String currentReflection,
        String perspectiveSummary,
        String promptVersion,
        String depth,
        boolean testData
    ) {
        return suggestWithMetadata(
            windowId, currentReflection, perspectiveSummary, promptVersion, depth, testData,
            GenerationLocale.KO
        );
    }

    public AiGenerationResult<String> suggestWithMetadata(
        Long windowId,
        String currentReflection,
        String perspectiveSummary,
        String promptVersion,
        String depth,
        boolean testData,
        GenerationLocale locale
    ) {
        String prompt = """
            %s Compare the current Reflection with the perspective encountered in the discussion and draft a refinement suggestion.
            Preserve the reader's voice and core position. Do not invent book facts or personal experiences.
            This result is not saved automatically; the reader chooses and edits it directly.

            Current Reflection:
            %s

            Discussion perspective:
            %s
            """.formatted(locale.languageInstruction(), currentReflection, perspectiveSummary);
        SendMessageRequest request = SendMessageRequest.builder().content(prompt).build();
        AiGenerationTask task = new AiGenerationTask(
            "REFLECTION_REFINEMENT",
            promptVersion,
            "text-v1",
            locale
        );
        AiGenerationResult<AiMessageResponse> generation = metadataGeneration(windowId, request, task);
        AiMessageResponse response = generation.value();
        String content = response == null ? null : response.getContent();
        AiLanguageValidationOutcome validation = languageValidator.validate(locale, content);
        boolean persistable = content != null
            && !content.isBlank()
            && !generation.fallbackUsed()
            && "SUCCESS".equalsIgnoreCase(generation.outcome());
        AiGenerationResult<String> result = !persistable
            ? generation.<String>withValue(null, "FAILURE", false, validation)
            : validation == AiLanguageValidationOutcome.KNOWN_MISMATCH
                ? generation.<String>withValue(null, "FAILURE", false, validation)
                    .withFailureCategory("SCHEMA_VALIDATION")
                : generation.withValue(content, generation.outcome(), generation.fallbackUsed(), validation);
        generationObserver.observe(result, depth, testData);
        return result;
    }

    private AiGenerationResult<AiMessageResponse> metadataGeneration(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            return aiProvider.answerWindowMessageWithMetadata(windowId, request, task);
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
}
