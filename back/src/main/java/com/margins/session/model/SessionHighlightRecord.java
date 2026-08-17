package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionHighlightRecord {
    private Long id;
    private Long sessionId;
    private Long bookId;
    private Long userId;
    private Integer pageNumber;
    private String locationLabel;
    private String quoteText;
    private String note;
    private Integer highlightOrder;
    private boolean testData;
}
