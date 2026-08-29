package com.margins.ai;

import com.margins.ai.observability.AiTraceContext;

/** Best-effort sink for raw-free AI generation operations metadata. */
@FunctionalInterface
public interface AiGenerationObserver {
    AiGenerationObserver NO_OP = (result, depth, testData) -> { };

    void observe(AiGenerationResult<?> result, String depth, boolean testData);

    default void observe(
        AiGenerationResult<?> result,
        String depth,
        boolean testData,
        AiTraceContext traceContext
    ) {
        observe(result, depth, testData);
    }
}
