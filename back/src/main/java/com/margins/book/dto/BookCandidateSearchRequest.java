package com.margins.book.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class BookCandidateSearchRequest {
    @NotBlank
    String query;

    @Min(1)
    @Max(1000)
    Integer page;

    @Min(1)
    @Max(40)
    Integer limit;
}
