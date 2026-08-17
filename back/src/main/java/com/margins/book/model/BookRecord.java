package com.margins.book.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookRecord {
    private Long id;
    private Long userId;
    private String title;
    private String subtitle;
    private String author;
    private String publisher;
    private String isbn;
    private Integer publishedYear;
    private String languageCode;
    private String description;
    private String source;
    private String sourceRef;
    private String coverImageUrl;
    private String rawMetadata;
    private String readingStatus;
    private Double rating;
    private LocalDateTime statusStartedAt;
    private LocalDateTime statusFinishedAt;
    private LocalDateTime updatedAt;
    private boolean testData;
}
