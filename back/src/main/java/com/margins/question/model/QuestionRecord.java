package com.margins.question.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionRecord {
    private Long id;
    private Long sessionId;
    private Long windowId;
    private Long userId;
    private Long reflectionInterviewId;
    private String questionText;
    private String questionType;
    private String coverageArea;
    private String responseMode;
    private String sourceType;
    private Long sourceRefId;
    private String sourceExcerpt;
    private String sourceVersion;
    private boolean sourceStale;
    private boolean sourceFallback;
    private String sensitivity;
    private String status;
    private String aiModel;
    private String generationLocale;
    private String languageValidationOutcome;
    private boolean testData;
}
