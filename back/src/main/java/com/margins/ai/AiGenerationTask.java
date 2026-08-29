package com.margins.ai;

/** Domain-owned task and version labels supplied to the common AI transport boundary. */
public record AiGenerationTask(
    String taskType,
    String promptVersion,
    String schemaVersion,
    GenerationLocale generationLocale,
    boolean localeScoped
) {
    public AiGenerationTask(
        String taskType,
        String promptVersion,
        String schemaVersion,
        GenerationLocale generationLocale
    ) {
        this(taskType, promptVersion, schemaVersion, generationLocale, true);
    }

    public AiGenerationTask {
        taskType = normalized(taskType, "UNKNOWN");
        promptVersion = normalized(promptVersion, "unknown");
        schemaVersion = normalized(schemaVersion, "none");
        if (generationLocale == null) {
            throw new IllegalArgumentException("generationLocale is required");
        }
        if (!localeScoped) {
            throw new IllegalArgumentException("localeScoped generation tasks are required");
        }
    }

    private static String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
