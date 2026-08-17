package com.margins.reflectionloop.model.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PerspectiveCandidateDto {
    Long personaId;
    String displayName;
    String description;
}
