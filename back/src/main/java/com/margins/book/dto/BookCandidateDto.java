package com.margins.book.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookCandidateDto {
    String candidateId;
    String isbn;
    String isbn10;
    String isbn13;
    String title;
    String subtitle;
    String author;
    List<String> authors;
    String publisher;
    String publishedDate;
    Integer publishedYear;
    String description;
    String thumbnail;
    String language;
    Integer pageCount;
    String reason;
}
