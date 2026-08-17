package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionRunResponse {
    Long runId;
    Long guideId;
    Long windowId;
    Long sessionId;
    String status;
    DiscussionQuestionDto currentItem;
    String lastDirectorAction;
    List<PerspectiveCandidateDto> perspectiveCandidates;
    boolean perspectiveSelectionRequired;
}
