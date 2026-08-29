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
public class DiscussionRunRefinementRecord {
    private Long id;
    private Long runId;
    private String generationLocale;
    private String inputHash;
    private String transcriptHash;
    private String promptVersion;
    private String status;
    private String suggestionContent;
    private String generationMetadataJson;
    private String languageValidationOutcome;
    private boolean testData;
    private LocalDateTime generatedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
