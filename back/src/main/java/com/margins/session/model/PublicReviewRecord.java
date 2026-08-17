package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicReviewRecord {
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
    private java.time.LocalDate reviewedOn;
    private java.time.LocalDateTime createdAt;
    private java.time.LocalDateTime updatedAt;
}
