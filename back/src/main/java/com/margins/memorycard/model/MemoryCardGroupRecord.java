package com.margins.memorycard.model;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MemoryCardGroupRecord {
    Long id;
    Long userId;
    String title;
    String description;
    String sourceLabel;
    Integer cardCount;
    Boolean testData;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
