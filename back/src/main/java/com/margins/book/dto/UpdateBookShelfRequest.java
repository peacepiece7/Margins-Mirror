package com.margins.book.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class UpdateBookShelfRequest {
    @Size(max = 40)
    String readingStatus;
    @DecimalMin("0.5")
    @DecimalMax("5.0")
    Double rating;
    @Builder.Default
    boolean clearRating = false;
}
