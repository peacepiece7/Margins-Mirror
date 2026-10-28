package com.margins.book.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryRevisionSummary {
    Long revisionId;
    Integer version;
    String revisionSource;
    String createdAt;
}
