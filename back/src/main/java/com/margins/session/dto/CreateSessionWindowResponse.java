package com.margins.session.dto;

import lombok.Builder;
import lombok.Value;
import java.util.List;

@Value
@Builder
public class CreateSessionWindowResponse {
    Long windowId;
    Long sessionId;
    Long sourceQuestionId;
    String windowType;
    String title;
    String status;
    List<Long> personaIds;
}
