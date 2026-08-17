package com.margins.session.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class SendMessageRequest {
    Long userId;
    @NotBlank
    String content;
    Long questionId;
    String clientCorrelationId;
    @JsonIgnore Long contextMessageId;
}
