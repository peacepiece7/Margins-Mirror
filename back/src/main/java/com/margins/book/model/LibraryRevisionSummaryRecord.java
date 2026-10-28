package com.margins.book.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LibraryRevisionSummaryRecord {
    private Long bookId;
    private Long revisionId;
    private Integer version;
    private String revisionSource;
    private LocalDateTime createdAt;
}
