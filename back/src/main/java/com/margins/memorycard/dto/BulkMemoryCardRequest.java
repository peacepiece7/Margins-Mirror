package com.margins.memorycard.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Data;

@Data
public class BulkMemoryCardRequest {
    String duplicatePolicy = "replace";

    @Valid
    @NotEmpty
    @Size(max = 500)
    List<MemoryCardInputDto> cards;
}
