package com.margins.reflectionloop.model.dto.response;

import com.margins.reflectionloop.model.enums.DiscussionGuideProjection;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public final class FacilitatorDiscussionGuideProjectionResponse
    implements DiscussionGuideProjectionResponse {
    DiscussionGuideProjection projection;
    Long guideId;
    Integer guideVersion;
    boolean current;
    String bookTitle;
    String bookAuthor;
    String goal;
    List<String> issues;
    Integer targetMinutes;
    List<FacilitatorDiscussionQuestionDto> items;
}
