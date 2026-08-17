package com.margins.book.dto;

import com.margins.book.model.BookReadingStatus;
import com.margins.book.model.BookRecord;
import java.time.format.DateTimeFormatter;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SaveBookResponse {
    Long bookId;
    String title;
    String subtitle;
    String author;
    String publisher;
    Integer publishedYear;
    String isbn;
    String source;
    String sourceRef;
    String coverImageUrl;
    String language;
    String readingStatus;
    Double rating;
    String statusStartedAt;
    String statusFinishedAt;
    String updatedAt;

    /**
     * 데이터베이스 레코드를 shelf와 세션 시작 흐름이 쓰는 API 응답으로 만든다.
     */
    public static SaveBookResponse from(BookRecord record) {
        return SaveBookResponse.builder()
                .bookId(record.getId())
                .title(record.getTitle())
                .subtitle(record.getSubtitle())
                .author(record.getAuthor())
                .publisher(record.getPublisher())
                .publishedYear(record.getPublishedYear())
                .isbn(record.getIsbn())
                .source(record.getSource())
                .sourceRef(record.getSourceRef())
                .coverImageUrl(record.getCoverImageUrl())
                .language(record.getLanguageCode())
                .readingStatus(record.getReadingStatus() == null
                        ? BookReadingStatus.WANT_TO_READ
                        : record.getReadingStatus())
                .rating(record.getRating())
                .statusStartedAt(record.getStatusStartedAt() == null
                        ? null
                        : record.getStatusStartedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .statusFinishedAt(record.getStatusFinishedAt() == null
                        ? null
                        : record.getStatusFinishedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .updatedAt(record.getUpdatedAt() == null
                        ? null
                        : record.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .build();
    }
}
