package com.margins.session.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class CreateSessionInsightRequest {
    @Size(max = 60)
    String insightType;

    @Size(max = 160)
    String title;

    @NotBlank
    String content;

    String evidence;

    @Size(max = 80)
    String authorName;

    @Pattern(regexp = "PUBLIC|PRIVATE|public|private")
    String visibility;

    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    String reviewedOn;
}
