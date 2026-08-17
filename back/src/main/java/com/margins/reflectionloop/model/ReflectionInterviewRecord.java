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
public class ReflectionInterviewRecord {
    private Long id;
    private Long reflectionInsightId;
    private Long sourceRevisionId;
    private Long sessionId;
    private Long windowId;
    private Long userId;
    private Long parentInterviewId;
    private Long forkQuestionId;
    private String status;
    private String coverageJson;
    private Integer answeredCount;
    private Integer skippedCount;
    private Integer generatedCount;
    private String promptVersion;
    private boolean testData;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
}
