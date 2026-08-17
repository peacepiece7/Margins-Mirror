package com.margins.session.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class CreateSessionHighlightRequest {
    @Min(0)
    Integer pageNumber;

    @Size(max = 120)
    String locationLabel;

    @NotBlank
    @Size(max = 5000)
    String quoteText;

    @Size(max = 2000)
    String note;
}
