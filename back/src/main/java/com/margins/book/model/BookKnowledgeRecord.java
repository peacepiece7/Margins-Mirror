package com.margins.book.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookKnowledgeRecord {
    private Long id;
    private String isbn;
    private String titleNormalized;
    private String authorNormalized;
    private String lookupKeyType;
    private String lookupKey;
    private String title;
    private String author;
    private String summary;
    private String themesJson;
    private String discussionPointsJson;
    private String recommendedPersonasJson;
    private String famousQuotesJson;
    private String keywordsJson;
    private String promptVersion;
    private String status;
    private boolean fallbackUsed;
    private boolean testData;
    private String failureReason;
    private String generationClaimToken;
    private LocalDateTime generationClaimedAt;
    private LocalDateTime generatedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
