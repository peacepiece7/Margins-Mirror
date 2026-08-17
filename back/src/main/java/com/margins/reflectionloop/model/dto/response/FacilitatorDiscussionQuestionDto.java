package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public final class FacilitatorDiscussionQuestionDto {
    String stage;
    String priority;
    Integer order;
    String question;
    String intent;
    String sourceType;
    String sourceLabel;
    String sourceExcerpt;
    String sourceVersion;
    boolean sourceStale;
    boolean sourceFallback;
    boolean privateSource;
    String sensitivity;
    boolean skippable;
    Integer expectedMinutes;
    List<String> followUps;
}
