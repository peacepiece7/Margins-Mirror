package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicReviewDto {
    private Long insightId;
    private Long sessionId;
    private Long bookId;
    private String bookTitle;
    private String bookAuthor;
    private String sessionTitle;
    private String title;
    private String content;
    private String evidence;
    private String authorName;
    private String reviewedOn;
    private String createdAt;
    private String updatedAt;
}
