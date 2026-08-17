package com.margins.reflectionloop.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReflectionRevisionRecord {
    private Long id;
    private Long reflectionInsightId;
    private Long sessionId;
    private Long userId;
    private Integer version;
    private String content;
    private String revisionSource;
    private Long sourceRevisionId;
    private boolean testData;
    private LocalDateTime createdAt;
}
