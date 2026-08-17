package com.margins.memorycard.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MemoryCardDto {
    Long cardId;
    Long groupId;
    String frontText;
    String backText;
    String exampleText;
    String memo;
    Boolean memorized;
    Integer position;
    String updatedAt;
}
