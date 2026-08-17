package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class UpdateInterviewAnswerRequest {
    @NotNull
    @Positive
    Long expectedAnswerVersion;

    @NotBlank
    @Size(max = 12000)
    String content;

    @NotNull
    @Pattern(regexp = "WORDING_ONLY|RESTART_FROM_HERE")
    String revisionKind;
}
