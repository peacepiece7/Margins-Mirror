package com.margins.moderation.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModerationEventDto {
    private Long eventId;
    private Long sessionId;
    private Long windowId;
    private String decision;
    private String intent;
    private String reasonCode;
    private String suggestedQuestion;
    private boolean fallbackUsed;
    private String routingOutcome;
    private boolean personaCalled;
    private String userFeedback;
    private Instant createdAt;
}
