package com.margins.persona.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class CreatePersonaRequest {
    @NotBlank
    @Size(max = 120)
    String displayName;
    String description;
    @NotBlank
    String systemPrompt;
    @Size(max = 120)
    String tone;
}
