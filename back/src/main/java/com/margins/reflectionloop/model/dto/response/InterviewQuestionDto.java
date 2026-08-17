package com.margins.reflectionloop.model.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class InterviewQuestionDto {
    Long questionId;
    String question;
    String coverageArea;
    String sourceType;
    Long sourceRefId;
    String sourceExcerpt;
    String sourceVersion;
    boolean sourceStale;
    boolean sourceFallback;
    String sensitivity;
    String status;
}
