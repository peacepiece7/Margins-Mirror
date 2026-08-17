package com.margins.ai;

/** Domain-owned task and version labels supplied to the common AI transport boundary. */
public record AiGenerationTask(
    String taskType,
    String promptVersion,
    String schemaVersion
) {
    public AiGenerationTask {
        taskType = normalized(taskType, "UNKNOWN");
        promptVersion = normalized(promptVersion, "unknown");
        schemaVersion = normalized(schemaVersion, "none");
    }

    private static String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
