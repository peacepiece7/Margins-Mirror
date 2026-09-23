package com.margins.book.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryThreadResponse {
    List<LibraryThreadItem> threads;
    String nextCursor;
    LibrarySummary summary;
}
