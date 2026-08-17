package com.margins.reflectionloop.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscussionGuideItemRecord {
    private Long id;
    private Long guideId;
    private Long questionId;
    private String questionText;
    private String stage;
    private String priority;
    private Integer itemOrder;
    private String intent;
    private String sourceType;
    private Long sourceRefId;
    private String sourceExcerpt;
    private String sourceVersion;
    private boolean sourceStale;
    private boolean sourceFallback;
    private String sensitivity;
    private boolean skippable;
    private Integer expectedMinutes;
    private String followUpsJson;
    private boolean testData;
    private LocalDateTime createdAt;
}
