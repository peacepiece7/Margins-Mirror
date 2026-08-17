package com.margins.memorycard.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MemoryCardListResponse {
    Long groupId;
    List<MemoryCardDto> cards;
}
