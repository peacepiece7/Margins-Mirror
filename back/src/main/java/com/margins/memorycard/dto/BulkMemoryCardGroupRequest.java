package com.margins.memorycard.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class BulkMemoryCardGroupRequest extends BulkMemoryCardRequest {
    @Valid
    @NotNull
    CreateMemoryCardGroupRequest group;
}
