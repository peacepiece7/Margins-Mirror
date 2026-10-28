package com.margins.reflectionloop.model.dto.response;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReflectionLoopResponse {
    Long reflectionId;
    Long sessionId;
    Long bookId;
    String title;
    String evidence;
    String authorName;
    String visibility;
    LocalDate reviewedOn;
    RevisionDto currentRevision;
    List<RevisionDto> revisions;
    Long activeInterviewId;
    Long guideId;
    Long runId;
    String runStatus;
}
