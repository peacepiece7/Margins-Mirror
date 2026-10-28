package com.margins.memorycard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateMemoryCardGroupRequest {
    @Positive
    Long bookId;

    @NotBlank
    @Size(max = 255)
    String title;

    @Size(max = 1000)
    String description;

    @Size(max = 255)
    String sourceLabel;
}
