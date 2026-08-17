package com.margins.reflectionloop.model.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReflectionRefinementResponse {
    Long runId;
    Long reflectionId;
    String initialContent;
    String currentContent;
    String perspectiveSummary;
    String suggestionStatus;
    String suggestedContent;
}
