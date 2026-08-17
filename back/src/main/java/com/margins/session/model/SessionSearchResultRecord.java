package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionSearchResultRecord {
    private Long sessionId;
    private Long sourceId;
    private String resultType;
    private String bookTitle;
    private String sessionTitle;
    private String snippet;
}
