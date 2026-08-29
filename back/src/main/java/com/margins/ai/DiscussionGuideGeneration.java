package com.margins.ai;

import java.util.List;

public final class DiscussionGuideGeneration {
    private DiscussionGuideGeneration() {
    }

    public record Request(
        Long windowId,
        String promptVersion,
        String schemaVersion,
        String purpose,
        String audienceMode,
        int targetMinutes,
        String disclosureMode,
        String facilitationLevel,
        List<Evidence> evidence,
        GenerationLocale generationLocale
    ) {
        public Request {
            if (generationLocale == null) throw new IllegalArgumentException("generationLocale is required");
        }
    }

    public record Evidence(
        String alias,
        String type,
        Long refId,
        String excerpt
    ) {
    }

    public record Response(
        String goal,
        List<String> issues,
        List<Item> items,
        String provider,
        String model,
        String tokenUsage,
        int latencyMs,
        String outcome,
        boolean fallbackUsed
    ) {
    }

    public record Item(
        String stage,
        String priority,
        String question,
        String intent,
        String sourceAlias,
        String sensitivity,
        boolean skippable,
        int expectedMinutes,
        List<String> followUps
    ) {
    }
}
