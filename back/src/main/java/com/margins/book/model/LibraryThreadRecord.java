package com.margins.book.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class LibraryThreadRecord {
    private Long bookId;
    private Long userId;
    private String title;
    private String subtitle;
    private String author;
    private String publisher;
    private String isbn;
    private Integer publishedYear;
    private String languageCode;
    private String source;
    private String sourceRef;
    private String coverImageUrl;
    private String readingStatus;
    private Double rating;
    private LocalDateTime statusStartedAt;
    private LocalDateTime statusFinishedAt;
    private LocalDateTime bookUpdatedAt;
    private Long sessionId;
    private Long reflectionId;
    private Long currentRevisionId;
    private Integer currentRevisionNumber;
    private LocalDateTime currentRevisionAt;
    private Long interviewId;
    private Integer answeredCount;
    private String interviewStatus;
    private Long guideId;
    private String guideStatus;
    private Long runId;
    private String runStatus;
    private Long refinedRevisionId;
    private LocalDateTime runUpdatedAt;

    public BookRecord toBookRecord() {
        return BookRecord.builder()
            .id(bookId)
            .userId(userId)
            .title(title)
            .subtitle(subtitle)
            .author(author)
            .publisher(publisher)
            .isbn(isbn)
            .publishedYear(publishedYear)
            .languageCode(languageCode)
            .source(source)
            .sourceRef(sourceRef)
            .coverImageUrl(coverImageUrl)
            .readingStatus(readingStatus)
            .rating(rating)
            .statusStartedAt(statusStartedAt)
            .statusFinishedAt(statusFinishedAt)
            .updatedAt(bookUpdatedAt)
            .build();
    }
}
