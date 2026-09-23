package com.margins.book.dto;

import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibrarySummary {
    Map<String, Long> shelfCounts;
    Map<String, Long> stageCounts;
    List<LibraryActivitySummary> recentActivity;
}
