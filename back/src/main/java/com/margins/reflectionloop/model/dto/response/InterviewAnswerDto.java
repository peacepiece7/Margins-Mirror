package com.margins.reflectionloop.model.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class InterviewAnswerDto {
    Long answerRevisionId;
    Long questionId;
    String question;
    String content;
    Integer version;
    String responseMode;
}
