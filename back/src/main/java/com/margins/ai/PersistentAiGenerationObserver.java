package com.margins.ai;

import com.margins.ai.model.AiGenerationEventRecord;
import com.margins.common.support.RequestCorrelationContext;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PersistentAiGenerationObserver implements AiGenerationObserver {
    private static final Set<String> DEPTHS = Set.of("SIMPLE", "STANDARD", "DEEP");
    private static final Set<String> OUTCOMES = Set.of("SUCCESS", "FALLBACK", "FAILURE");
    private final AiGenerationEventPersister persister;

    @Override
    public void observe(AiGenerationResult<?> result, String depth, boolean testData) {
        if (result == null) {
            return;
        }
        try {
            persister.persist(AiGenerationEventRecord.builder()
                .requestId(UUID.randomUUID().toString())
                .correlationId(RequestCorrelationContext.current().orElse(null))
                .taskType(result.taskType())
                .depth(normalizedDepth(depth))
                .provider(result.provider())
                .model(result.model())
                .promptVersion(result.promptVersion())
                .schemaVersion(result.schemaVersion())
                .inputTokens(result.inputTokens())
                .cachedInputTokens(result.cachedInputTokens())
                .outputTokens(result.outputTokens())
                .latencyMs(result.latencyMs())
                .outcome(normalizedOutcome(result))
                .fallbackUsed(result.fallbackUsed())
                .failureCategory(
                    "FAILURE".equals(normalizedOutcome(result))
                        ? result.failureCategory()
                        : null
                )
                .testData(testData)
                .build());
        } catch (RuntimeException exception) {
            log.warn(
                "AI generation observability insert skipped taskType={} outcome={} error={}",
                result.taskType(),
                result.outcome(),
                exception.getClass().getSimpleName()
            );
        }
    }

    private String normalizedDepth(String depth) {
        if (depth == null || depth.isBlank()) {
            return null;
        }
        String normalized = depth.trim().toUpperCase(java.util.Locale.ROOT);
        return DEPTHS.contains(normalized) ? normalized : null;
    }

    private String normalizedOutcome(AiGenerationResult<?> result) {
        String outcome = result.outcome().toUpperCase(java.util.Locale.ROOT);
        if (OUTCOMES.contains(outcome)) {
            return outcome;
        }
        if (result.fallbackUsed()) {
            return "FALLBACK";
        }
        return result.value() == null ? "FAILURE" : "SUCCESS";
    }
}
