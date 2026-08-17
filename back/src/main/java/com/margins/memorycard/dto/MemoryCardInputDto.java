package com.margins.memorycard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MemoryCardInputDto {
    @NotBlank
    @Size(max = 200)
    String frontText;

    @NotBlank
    @Size(max = 500)
    String backText;

    @Size(max = 1000)
    String exampleText;

    @Size(max = 1000)
    String memo;
}
