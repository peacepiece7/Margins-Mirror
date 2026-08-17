package com.margins.book.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class SaveBookRequest {
    @NotBlank
    @Size(max = 255)
    String candidateId;
    @NotBlank
    @Size(max = 255)
    String title;
    @Size(max = 255)
    String subtitle;
    @NotBlank
    @Size(max = 255)
    String author;
    List<String> authors;
    @Size(max = 255)
    String publisher;
    @Size(max = 255)
    String publishedDate;
    @Size(max = 32)
    String isbn;
    @Size(max = 32)
    String isbn10;
    @Size(max = 32)
    String isbn13;
    Integer publishedYear;
    String description;
    @Size(max = 1000)
    String thumbnail;
    @Size(max = 16)
    String language;
    Integer pageCount;
}
