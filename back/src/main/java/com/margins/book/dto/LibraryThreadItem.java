package com.margins.book.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryThreadItem {
    SaveBookResponse book;
    LibraryLoopSummary loop;
    List<LibraryRevisionSummary> recentRevisions;
    String version;
}
