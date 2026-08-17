package com.margins.reflectionloop.model.dto.response;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionGuideVersionSummary {
    Long guideId;
    Integer guideVersion;
    String origin;
    String status;
    boolean current;
    boolean hasRun;
    LocalDateTime createdAt;
}
