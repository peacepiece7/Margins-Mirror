package com.margins.metric.dto;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricSnapshotResponse {
    private Long metricId;
    private Long sessionId;
    private String metricName;
    private BigDecimal metricValue;
    private String metricUnit;
    private Integer windowCount;
    private Integer questionCount;
    private Integer answeredQuestionCount;
    private Integer highlightCount;
    private Integer messageCount;
    private Integer personaCount;
}
