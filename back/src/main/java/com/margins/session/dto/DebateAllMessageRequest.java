package com.margins.session.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class DebateAllMessageRequest {
    Long userId;
    @NotBlank
    String content;
    @Size(max = 12)
    List<Long> personaIds;
    String clientCorrelationId;
}
