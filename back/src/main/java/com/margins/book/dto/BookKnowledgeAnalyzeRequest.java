package com.margins.book.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookKnowledgeAnalyzeRequest {
    String title;
    String author;
    String isbn;
    Integer publishedYear;
    String description;
    String language;
    String promptVersion;
}
