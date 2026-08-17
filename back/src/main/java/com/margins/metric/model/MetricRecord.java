package com.margins.metric.model;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricRecord {
    private Long id;
    private Long userId;
    private Long bookId;
    private Long sessionId;
    private String metricName;
    private String metricScope;
    private BigDecimal metricValue;
    private String metricUnit;
    private String metricDetails;
    private String sourceRef;
    private String generatedBy;
    private boolean testData;
}
