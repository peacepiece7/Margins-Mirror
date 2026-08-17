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
public class InterviewResponseRequest {
    @NotNull
    Long questionId;
    @NotNull
    @Pattern(regexp = "ANSWER|BOOK_ONLY|SKIP")
    String mode;
    @Size(max = 12000)
    String content;
}
