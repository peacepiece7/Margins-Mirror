package com.margins.ai;

/** Best-effort sink for raw-free AI generation operations metadata. */
@FunctionalInterface
public interface AiGenerationObserver {
    AiGenerationObserver NO_OP = (result, depth, testData) -> { };

    void observe(AiGenerationResult<?> result, String depth, boolean testData);
}
