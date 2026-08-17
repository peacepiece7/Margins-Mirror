package com.margins.reflectionloop.model.dto.response;

import com.margins.moderation.dto.ModerationEventDto;
import com.margins.session.dto.AiMessageResponse;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class GuidedDiscussionTurnResponse {
    Long runId;
    String runStatus;
    ModerationEventDto moderation;
    List<AiMessageResponse> messages;
    String directorAction;
    DiscussionQuestionDto currentItem;
    DiscussionQuestionDto nextItem;
    List<PerspectiveCandidateDto> perspectiveCandidates;
    boolean perspectiveSelectionRequired;
}
