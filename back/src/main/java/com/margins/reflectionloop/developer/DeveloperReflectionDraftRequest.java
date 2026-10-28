package com.margins.reflectionloop.developer;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class DeveloperReflectionDraftRequest {
    @NotBlank
    @Pattern(regexp = "PRIMARY_REFLECTION|QUESTION_ANSWER|INTERVIEW_ANSWER|DISCUSSION_TURN")
    String target;

    @NotNull
    @Positive
    Long bookId;

    @Size(max = 2000)
    String subject;

    @Size(max = 8000)
    String context;
}
