package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionSearchResultDto {
    private Long sessionId;
    private Long sourceId;
    private String resultType;
    private String bookTitle;
    private String sessionTitle;
    private String snippet;
}
