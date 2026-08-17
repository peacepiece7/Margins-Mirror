package com.margins.reflectionloop.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscussionGuideRecord {
    private Long id;
    private Long reflectionInsightId;
    private Long sourceRevisionId;
    private Long interviewId;
    private Long sessionId;
    private Long userId;
    private String depth;
    private String purpose;
    private String facilitationLevel;
    private String audienceMode;
    private Integer targetMinutes;
    private String disclosureMode;
    private String goal;
    private String issuesJson;
    private String status;
    private String promptVersion;
    private String model;
    private String tokenUsageJson;
    private String generationMetadataJson;
    private Integer guideVersion;
    private Long sourceGuideId;
    private String origin;
    private Boolean isCurrent;
    private Long currentInterviewId;
    private LocalDateTime archivedAt;
    private Boolean hasRun;
    private boolean testData;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
