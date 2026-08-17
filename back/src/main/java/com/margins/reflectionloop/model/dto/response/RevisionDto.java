package com.margins.reflectionloop.model.dto.response;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class RevisionDto {
    Long revisionId;
    Integer version;
    String content;
    String revisionSource;
    Long sourceRevisionId;
    LocalDateTime createdAt;
}
