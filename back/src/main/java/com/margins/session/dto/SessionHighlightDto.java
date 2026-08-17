package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionHighlightDto {
    private Long highlightId;
    private Long sessionId;
    private Long bookId;
    private Integer pageNumber;
    private String locationLabel;
    private String quoteText;
    private String note;
    private Integer highlightOrder;
}
