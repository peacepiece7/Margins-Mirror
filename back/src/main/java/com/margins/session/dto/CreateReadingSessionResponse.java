package com.margins.session.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CreateReadingSessionResponse {
    Long sessionId;
    Long bookId;
    String title;
}
