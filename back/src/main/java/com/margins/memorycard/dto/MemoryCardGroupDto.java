package com.margins.memorycard.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MemoryCardGroupDto {
    Long groupId;
    Long bookId;
    String title;
    String description;
    String sourceLabel;
    Integer cardCount;
    String updatedAt;
    List<MemoryCardDto> cards;
}
