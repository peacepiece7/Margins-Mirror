package com.margins.book.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class UpdateBookRequest {
    @NotBlank
    @Size(max = 255)
    String title;
    @NotBlank
    @Size(max = 255)
    String author;
    Integer publishedYear;
}
