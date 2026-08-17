package com.margins.memorycard.model;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MemoryCardRecord {
    Long id;
    Long groupId;
    String frontText;
    String backText;
    String exampleText;
    String memo;
    Boolean memorized;
    Integer position;
    Boolean testData;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
