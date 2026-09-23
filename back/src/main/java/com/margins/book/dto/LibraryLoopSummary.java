package com.margins.book.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryLoopSummary {
    String stage;
    Long reflectionId;
    Long currentRevisionId;
    Integer currentRevisionNumber;
    String currentRevisionAt;
    Long interviewId;
    Integer answeredCount;
    Integer targetCount;
    Long guideId;
    Long runId;
    String runStatus;
    LibraryContinueLocator continueLocator;
}
