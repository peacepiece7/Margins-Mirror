package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewCommentDto {
    private Long commentId;
    private Long insightId;
    private Long parentCommentId;
    private String authorName;
    private String content;
    private boolean ownedByCurrentReader;
    private String createdAt;
    private String updatedAt;
}
