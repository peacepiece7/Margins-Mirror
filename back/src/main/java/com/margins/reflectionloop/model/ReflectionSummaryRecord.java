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
public class ReflectionSummaryRecord {
    private Long id;
    private Long reflectionInsightId;
    private String generationLocale;
    private String sourceHash;
    private String summary;
    private String model;
    private String tokenUsageJson;
    private String languageValidationOutcome;
    private boolean testData;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
