package com.margins.book.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookCandidateSearchResponse {
    List<BookCandidateDto> candidates;
    Integer page;
    Integer limit;
    Integer totalItems;
    Boolean hasMore;
}
