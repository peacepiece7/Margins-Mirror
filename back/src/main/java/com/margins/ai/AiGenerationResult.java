package com.margins.ai;

import java.util.Set;

/** Common result envelope. Domain clients retain prompt, schema and failure-policy ownership. */
public record AiGenerationResult<T>(
    T value,
    String taskType,
    String provider,
    String model,
    String promptVersion,
    String schemaVersion,
    long inputTokens,
    long cachedInputTokens,
    long outputTokens,
    int latencyMs,
    String outcome,
    boolean fallbackUsed,
    String failureCategory
) {
    private static final Set<String> FAILURE_CATEGORIES = Set.of(
        "TIMEOUT",
        "REFUSAL",
        "TRANSPORT",
        "MALFORMED_OUTPUT",
        "SCHEMA_VALIDATION",
        "EVIDENCE_VALIDATION",
        "UNCLASSIFIED"
    );

    public AiGenerationResult {
        taskType = normalized(taskType, "UNKNOWN");
        provider = normalized(provider, "unknown");
        model = normalized(model, "unknown");
        promptVersion = normalized(promptVersion, "unknown");
        schemaVersion = normalized(schemaVersion, "none");
        inputTokens = Math.max(0, inputTokens);
        cachedInputTokens = Math.max(0, cachedInputTokens);
        outputTokens = Math.max(0, outputTokens);
        latencyMs = Math.max(0, latencyMs);
        outcome = normalized(outcome, "UNKNOWN");
        String normalizedFailureCategory = normalized(
            failureCategory,
            "UNCLASSIFIED"
        ).toUpperCase(java.util.Locale.ROOT);
        failureCategory = "FAILURE".equalsIgnoreCase(outcome)
            && FAILURE_CATEGORIES.contains(normalizedFailureCategory)
                ? normalizedFailureCategory
                : "FAILURE".equalsIgnoreCase(outcome) ? "UNCLASSIFIED" : null;
    }

    public static <T> AiGenerationResult<T> completed(
        T value,
        AiGenerationTask task,
        String provider,
        String model,
        AiTokenUsage usage,
        int latencyMs,
        String outcome,
        boolean fallbackUsed
    ) {
        AiTokenUsage safeUsage = usage == null ? AiTokenUsage.NONE : usage;
        return new AiGenerationResult<>(
            value,
            task.taskType(),
            provider,
            model,
            task.promptVersion(),
            task.schemaVersion(),
            safeUsage.inputTokens(),
            safeUsage.cachedInputTokens(),
            safeUsage.outputTokens(),
            latencyMs,
            outcome,
            fallbackUsed,
            null
        );
    }

    public static <T> AiGenerationResult<T> failure(
        AiGenerationTask task,
        String provider,
        String model,
        int latencyMs
    ) {
        return failure(
            task,
            provider,
            model,
            AiTokenUsage.NONE,
            latencyMs,
            "UNCLASSIFIED"
        );
    }

    public static <T> AiGenerationResult<T> failure(
        AiGenerationTask task,
        String provider,
        String model,
        AiTokenUsage usage,
        int latencyMs,
        String failureCategory
    ) {
        return AiGenerationResult.<T>completed(
            null,
            task,
            provider,
            model,
            usage,
            latencyMs,
            "FAILURE",
            false
        ).withFailureCategory(failureCategory);
    }

    public AiTokenUsage tokenUsage() {
        return new AiTokenUsage(
            inputTokens,
            cachedInputTokens,
            outputTokens,
            inputTokens + outputTokens
        );
    }

    public AiGenerationResult<T> withOutcome(String finalOutcome, boolean finalFallbackUsed) {
        return new AiGenerationResult<>(
            value,
            taskType,
            provider,
            model,
            promptVersion,
            schemaVersion,
            inputTokens,
            cachedInputTokens,
            outputTokens,
            latencyMs,
            finalOutcome,
            finalFallbackUsed,
            "FAILURE".equalsIgnoreCase(finalOutcome) ? failureCategory : null
        );
    }

    public AiGenerationResult<T> withFailureCategory(String finalFailureCategory) {
        return new AiGenerationResult<>(
            value,
            taskType,
            provider,
            model,
            promptVersion,
            schemaVersion,
            inputTokens,
            cachedInputTokens,
            outputTokens,
            latencyMs,
            "FAILURE",
            false,
            finalFailureCategory
        );
    }

    private static String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
