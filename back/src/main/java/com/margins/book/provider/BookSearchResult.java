package com.margins.book.provider;

import com.margins.book.dto.BookCandidateDto;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookSearchResult {
    List<BookCandidateDto> candidates;
    Integer totalItems;

    public static BookSearchResult empty() {
        return BookSearchResult.builder()
            .candidates(List.of())
            .build();
    }
}
