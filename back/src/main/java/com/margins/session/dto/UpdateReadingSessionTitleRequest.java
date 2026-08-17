package com.margins.session.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class UpdateReadingSessionTitleRequest {
    @NotBlank
    @Size(max = 200)
    String title;
}
