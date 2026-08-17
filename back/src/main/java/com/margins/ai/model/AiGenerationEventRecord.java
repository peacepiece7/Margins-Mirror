package com.margins.ai.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiGenerationEventRecord {
    private Long id;
    private String requestId;
    private String correlationId;
    private String taskType;
    private String depth;
    private String provider;
    private String model;
    private String promptVersion;
    private String schemaVersion;
    private long inputTokens;
    private long cachedInputTokens;
    private long outputTokens;
    private int latencyMs;
    private String outcome;
    private boolean fallbackUsed;
    private String failureCategory;
    private boolean testData;
    private Instant createdAt;
}
