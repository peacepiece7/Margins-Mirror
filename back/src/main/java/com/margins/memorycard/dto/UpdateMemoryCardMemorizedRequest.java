package com.margins.memorycard.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateMemoryCardMemorizedRequest {
    @NotNull
    Boolean memorized;
}
