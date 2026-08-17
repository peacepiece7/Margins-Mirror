package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionInsightRecord {
    private Long id;
    private Long sessionId;
    private Long userId;
    private Long questionId;
    private String insightType;
    private String title;
    private String content;
    private String evidence;
    private String authorName;
    private String visibility;
    private java.time.LocalDate reviewedOn;
    private Integer insightOrder;
    private java.time.LocalDateTime createdAt;
    private java.time.LocalDateTime updatedAt;
    private boolean testData;
}
