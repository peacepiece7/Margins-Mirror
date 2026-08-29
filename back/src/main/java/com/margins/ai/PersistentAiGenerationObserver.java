package com.margins.ai;

import com.margins.ai.model.AiGenerationEventRecord;
import com.margins.ai.observability.AiGenerationTraceSink;
import com.margins.ai.observability.AiTraceContext;
import com.margins.common.support.RequestCorrelationContext;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class PersistentAiGenerationObserver implements AiGenerationObserver {
    private static final Set<String> DEPTHS = Set.of("SIMPLE", "STANDARD", "DEEP");
    private static final Set<String> OUTCOMES = Set.of("SUCCESS", "FALLBACK", "FAILURE");
    private final AiGenerationEventPersister persister;
    private final AiGenerationTraceSink traceSink;

    @Autowired
    public PersistentAiGenerationObserver(
        AiGenerationEventPersister persister,
        AiGenerationTraceSink traceSink
    ) {
        this.persister = persister;
        this.traceSink = traceSink;
    }

    public PersistentAiGenerationObserver(AiGenerationEventPersister persister) {
        this(persister, AiGenerationTraceSink.NO_OP);
    }

    @Override
    public void observe(AiGenerationResult<?> result, String depth, boolean testData) {
        observe(result, depth, testData, AiTraceContext.EMPTY);
    }

    @Override
    public void observe(
        AiGenerationResult<?> result,
        String depth,
        boolean testData,
        AiTraceContext traceContext
    ) {
        if (result == null) {
            return;
        }
        trace(result, depth, testData, traceContext);
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
                .generationLocale(
                    result.generationLocale() == null ? null : result.generationLocale().value()
                )
                .languageValidationOutcome(
                    result.languageValidationOutcome() == null
                        ? null
                        : result.languageValidationOutcome().name()
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

    private void trace(
        AiGenerationResult<?> result,
        String depth,
        boolean testData,
        AiTraceContext traceContext
    ) {
        try {
            traceSink.trace(result, depth, testData, traceContext);
        } catch (RuntimeException exception) {
            log.warn(
                "Langfuse generation trace skipped taskType={} outcome={} error={}",
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
