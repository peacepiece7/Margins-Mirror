package com.margins.moderation.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class ModerationEventRecord {
    private Long id;
    private String requestId;
    private Long userId;
    private Long bookId;
    private Long sessionId;
    private Long windowId;
    private Long messageId;
    private String inputText;
    private String decision;
    private String intent;
    private double relevanceScore;
    private double confidence;
    private String reasonCode;
    private String suggestedQuestion;
    private String model;
    private String policyVersion;
    private String promptVersion;
    private String schemaVersion;
    private int latencyMs;
    private boolean fallbackUsed;
    private String routingOutcome;
    private boolean personaCalled;
    private String providerErrorCode;
    private String userFeedback;
    private boolean testData;
    private Instant createdAt;
    private Instant updatedAt;
}
