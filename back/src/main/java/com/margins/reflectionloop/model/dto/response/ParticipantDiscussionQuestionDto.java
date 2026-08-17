package com.margins.reflectionloop.model.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public final class ParticipantDiscussionQuestionDto {
    String stage;
    String priority;
    Integer order;
    String question;
}
