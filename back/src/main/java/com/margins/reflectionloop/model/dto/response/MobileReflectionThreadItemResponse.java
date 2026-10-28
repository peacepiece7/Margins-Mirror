package com.margins.reflectionloop.model.dto.response;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MobileReflectionThreadItemResponse {
    Long bookId;
    String bookTitle;
    String bookAuthor;
    String coverImageUrl;
    Long sessionId;
    Long reflectionId;
    Integer revisionCount;
    String reflectionPreview;
    Long interviewId;
    String interviewStatus;
    Integer answeredCount;
    Integer targetAnswers;
    Integer generatedCount;
    String currentQuestion;
    Long guideId;
    Long runId;
    String runStatus;
    String refinementOutcome;
    LocalDateTime lastActivityAt;
}
