package com.margins.reflectionloop.ai;

import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
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

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    public String suggest(Long windowId, String currentReflection, String perspectiveSummary) {
        return suggest(
            windowId,
            currentReflection,
            perspectiveSummary,
            "reflection-refinement-v1",
            null,
            false
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
        AiGenerationResult<String> generation = suggestWithMetadata(
            windowId,
            currentReflection,
            perspectiveSummary,
            promptVersion,
            depth,
            testData
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
        String prompt = """
            아래 현재 Reflection과 토론에서 만난 관점을 비교해 수정 제안 초안을 작성해 주세요.
            독자의 말투와 핵심 입장을 유지하고, 새로운 책 사실이나 개인 경험을 만들지 마세요.
            이 결과는 자동 저장되지 않으며 독자가 직접 선택·수정합니다.

            현재 Reflection:
            %s

            토론 관점:
            %s
            """.formatted(currentReflection, perspectiveSummary);
        SendMessageRequest request = SendMessageRequest.builder().content(prompt).build();
        AiGenerationTask task = new AiGenerationTask(
            "REFLECTION_REFINEMENT",
            promptVersion,
            "text-v1"
        );
        AiGenerationResult<AiMessageResponse> generation =
            metadataGeneration(windowId, request, task);
        if (generation == null) {
            generation = legacyGeneration(windowId, request, task);
        }
        AiMessageResponse response = generation.value();
        String content = response == null ? null : response.getContent();
        boolean failed = content == null || content.isBlank();
        AiGenerationResult<String> result = new AiGenerationResult<>(
            failed ? null : content,
            generation.taskType(),
            generation.provider(),
            generation.model(),
            generation.promptVersion(),
            generation.schemaVersion(),
            generation.inputTokens(),
            generation.cachedInputTokens(),
            generation.outputTokens(),
            generation.latencyMs(),
            failed ? "FAILURE" : generation.outcome(),
            generation.fallbackUsed(),
            failed ? "SCHEMA_VALIDATION" : generation.failureCategory()
        );
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

    private AiGenerationResult<AiMessageResponse> legacyGeneration(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            AiMessageResponse response = aiProvider.answerWindowMessage(windowId, request);
            String model = response == null ? "unknown" : response.getAiModel();
            boolean fallbackUsed = "placeholder".equalsIgnoreCase(model);
            return AiGenerationResult.completed(
                response,
                task,
                fallbackUsed ? "placeholder" : "unknown",
                model,
                response == null ? AiTokenUsage.NONE : AiTokenUsage.fromJson(response.getTokenUsage()),
                elapsedMillis(startedAt),
                fallbackUsed ? "FALLBACK" : "SUCCESS",
                fallbackUsed
            );
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
