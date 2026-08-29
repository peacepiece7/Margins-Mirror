package com.margins.ai.observability;

import com.margins.ai.AiGenerationResult;
import java.time.Duration;

/** Best-effort external trace sink for raw-free generation result metadata. */
public interface AiGenerationTraceSink {
    AiGenerationTraceSink NO_OP = new AiGenerationTraceSink() {
        @Override
        public String trace(AiGenerationResult<?> result, String depth, boolean testData) {
            return null;
        }
    };

    String trace(AiGenerationResult<?> result, String depth, boolean testData);

    default String trace(
        AiGenerationResult<?> result,
        String depth,
        boolean testData,
        AiTraceContext traceContext
    ) {
        return trace(result, depth, testData);
    }

    default boolean flush(Duration timeout) {
        return true;
    }
}
