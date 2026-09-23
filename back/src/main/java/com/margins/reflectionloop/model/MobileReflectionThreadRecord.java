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
public class MobileReflectionThreadRecord {
    private Long bookId;
    private String bookTitle;
    private String bookAuthor;
    private String coverImageUrl;
    private Long sessionId;
    private Long reflectionId;
    private Integer revisionCount;
    private String reflectionPreview;
    private Long interviewId;
    private String interviewStatus;
    private Integer answeredCount;
    private Integer generatedCount;
    private String currentQuestion;
    private Long guideId;
    private Long runId;
    private String runStatus;
    private String refinementOutcome;
    private LocalDateTime lastActivityAt;
}
