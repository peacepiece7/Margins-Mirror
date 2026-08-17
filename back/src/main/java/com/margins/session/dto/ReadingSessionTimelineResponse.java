package com.margins.session.dto;

import com.margins.question.dto.QuestionDto;
import com.margins.moderation.dto.ModerationEventDto;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadingSessionTimelineResponse {
    private Long sessionId;
    private Long bookId;
    private String bookTitle;
    private String bookAuthor;
    private String title;

    private ReadingSessionStatsDto stats;
    private List<ReadingSessionNextActionDto> nextActions;
    private List<SessionWindowTimelineDto> windows;
    private List<SessionHighlightDto> highlights;
    private List<SessionTagDto> tags;
    private List<SessionInsightDto> insights;
    private List<QuestionDto> questions;
    private List<SessionMessageDto> messages;
    private List<ModerationEventDto> moderationEvents;
}
