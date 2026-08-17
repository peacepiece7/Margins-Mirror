package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReflectionLoopResponse {
    Long reflectionId;
    Long sessionId;
    String visibility;
    RevisionDto currentRevision;
    List<RevisionDto> revisions;
    Long activeInterviewId;
    Long guideId;
    Long runId;
    String runStatus;
}
