package com.margins.message.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageRecord {
    private Long id;
    private Long sessionId;
    private Long windowId;
    private Long userId;
    private Long parentMessageId;
    private String role;
    private String content;
    private Integer messageOrder;
    private String aiModel;
    private Long personaId;
    private Long questionId;
    private String contextSnapshot;
    private String tokenUsage;
    private String streamingStatus;
    private boolean testData;
    private Instant createdAt;
}
