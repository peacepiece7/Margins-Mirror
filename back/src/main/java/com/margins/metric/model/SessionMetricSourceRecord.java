package com.margins.metric.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionMetricSourceRecord {
    private Long userId;
    private Long bookId;
    private Long sessionId;

    private Integer windowCount;
    private Integer questionCount;
    private Integer answeredQuestionCount;
    private Integer highlightCount;
    private Integer messageCount;
    private Integer personaCount;
}
