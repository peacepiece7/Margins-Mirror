package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class SaveReflectionRequest {
    @NotBlank
    @Size(max = 20000)
    String content;
    @Size(max = 160)
    String title;
    @Size(max = 20000)
    String evidence;
    @Size(max = 120)
    String authorName;
    @Pattern(regexp = "PRIVATE|PUBLIC")
    String visibility;
    String reviewedOn;
}
