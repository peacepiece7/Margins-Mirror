package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionGuideVersionsResponse {
    Long interviewId;
    Long currentGuideId;
    List<DiscussionGuideVersionSummary> versions;
}
