package com.margins.moderation;

import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;

/** Persona 생성과 분리된 독서 토론 관련성 판정 경계다. */
public interface DiscussionModerator {
    DiscussionModerationResult moderate(DiscussionModerationRequest request);

    default AiGenerationResult<DiscussionModerationResult> moderateWithMetadata(
        DiscussionModerationRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            DiscussionModerationResult result = moderate(request);
            boolean fallbackUsed = result == null || result.isFallbackUsed();
            return AiGenerationResult.completed(
                result,
                task,
                "unknown",
                result == null ? "unknown" : result.getModel(),
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                fallbackUsed ? "FALLBACK" : "SUCCESS",
                fallbackUsed
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    private static int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }
}
