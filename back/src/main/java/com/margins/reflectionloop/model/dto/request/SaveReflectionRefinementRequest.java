package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class SaveReflectionRefinementRequest {
    @NotNull
    @Pattern(regexp = "EDITED|ACCEPTED_SUGGESTION|KEPT")
    String mode;
    @NotNull
    @Pattern(regexp = "DEEPENED|NEW_PERSPECTIVE|CHANGED|KEPT")
    String outcome;
    @Size(max = 20000)
    String finalContent;
}
