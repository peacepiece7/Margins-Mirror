package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscussionQuestionDto {
    Long itemId;
    Long questionId;
    String stage;
    String priority;
    Integer order;
    String question;
    String intent;
    String sourceType;
    Long sourceRefId;
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
