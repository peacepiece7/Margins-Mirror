package com.margins.book.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryActivitySummary {
    Long bookId;
    String bookTitle;
    String bookAuthor;
    Long revisionId;
    Integer version;
    String revisionSource;
    String createdAt;
}
