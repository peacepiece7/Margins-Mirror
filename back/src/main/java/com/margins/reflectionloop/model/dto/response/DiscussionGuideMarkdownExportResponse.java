package com.margins.reflectionloop.model.dto.response;

import com.margins.reflectionloop.model.enums.DiscussionGuideProjection;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionGuideMarkdownExportResponse {
    DiscussionGuideProjection projection;
    Long guideId;
    Integer guideVersion;
    String filename;
    String content;
}
