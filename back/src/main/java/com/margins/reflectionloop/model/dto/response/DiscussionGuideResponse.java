package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionGuideResponse {
    Long guideId;
    Long reflectionId;
    Long interviewId;
    Long sessionId;
    String depth;
    String purpose;
    String facilitationLevel;
    String audienceMode;
    Integer targetMinutes;
    String disclosureMode;
    String goal;
    List<String> issues;
    String status;
    Integer guideVersion;
    Long sourceGuideId;
    String origin;
    boolean current;
    Long currentGuideId;
    List<DiscussionQuestionDto> items;
    Long runId;
}
