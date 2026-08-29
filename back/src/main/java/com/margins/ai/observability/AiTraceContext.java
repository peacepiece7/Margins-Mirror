package com.margins.ai.observability;

/** Optional product identifiers used only after one-way pseudonymization for trace grouping. */
public record AiTraceContext(Long userId, Long sessionId) {
    public static final AiTraceContext EMPTY = new AiTraceContext(null, null);

    public AiTraceContext {
        if (userId != null && userId <= 0) {
            throw new IllegalArgumentException("userId must be positive");
        }
        if (sessionId != null && sessionId <= 0) {
            throw new IllegalArgumentException("sessionId must be positive");
        }
    }
}
