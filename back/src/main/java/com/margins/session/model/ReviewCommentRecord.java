package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewCommentRecord {
    private Long id;
    private Long insightId;
    private Long userId;
    private Long parentCommentId;
    private String authorName;
    private String content;
    private java.time.LocalDateTime createdAt;
    private java.time.LocalDateTime updatedAt;
    private boolean testData;
}
