package com.margins.session.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class DebateMessageRequest {
    Long userId;
    @NotNull
    Long personaId;
    @NotBlank
    String content;
    String clientCorrelationId;
    @JsonIgnore Long contextMessageId;
}
