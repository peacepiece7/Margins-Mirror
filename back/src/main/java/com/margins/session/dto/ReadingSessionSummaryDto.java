package com.margins.session.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadingSessionSummaryDto {
    private Long sessionId;
    private Long bookId;
    private String bookTitle;
    private String bookAuthor;
    private String title;

    private Integer windowCount;
    private Integer questionCount;
    private Integer answeredQuestionCount;
    private Integer highlightCount;
    private Integer messageCount;
    private List<SessionTagDto> tags;
}
