package com.margins.moderation;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionModerationResult {
    ModerationDecision decision;
    ModerationIntent intent;
    double relevanceScore;
    double confidence;
    String reasonCode;
    String suggestedQuestion;
    String model;
    int latencyMs;
    boolean fallbackUsed;
    String providerErrorCode;
}
