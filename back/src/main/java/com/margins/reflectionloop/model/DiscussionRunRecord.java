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
public class DiscussionRunRecord {
    private Long id;
    private Long guideId;
    private Long windowId;
    private Long sessionId;
    private Long userId;
    private Long currentItemId;
    private String status;
    private String refinementOutcome;
    private Long refinedRevisionId;

    private String directorVersion;
    private String lastDirectorAction;
    private Long pendingPerspectiveItemId;
    private String pendingPerspectiveIdsJson;
    private String pendingPerspectiveClaimToken;
    private LocalDateTime pendingPerspectiveClaimedAt;
    private boolean testData;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
