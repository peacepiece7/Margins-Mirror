package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionInsightDto {
    private Long insightId;
    private Long sessionId;
    private Long questionId;
    private String insightType;
    private String title;
    private String content;
    private String evidence;
    private String authorName;
    private String visibility;
    private String reviewedOn;
    private String createdAt;
    private String updatedAt;
    private Integer insightOrder;
}
