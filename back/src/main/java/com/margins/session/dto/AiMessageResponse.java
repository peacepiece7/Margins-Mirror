package com.margins.session.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder(toBuilder = true)
public class AiMessageResponse {
    Long messageId;
    Long windowId;
    Long personaId;
    String role;
    String content;
    boolean streamingReady;
    String aiModel;
    String contextSnapshot;
    String tokenUsage;
}
