package com.margins.session.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionMessageDto {
    private Long messageId;
    private Long sessionId;
    private Long windowId;
    private Long parentMessageId;
    private String role;
    private String content;
    private Integer messageOrder;
    private String aiModel;
    private Long personaId;
    private Long questionId;
    private String streamingStatus;
    private Instant createdAt;
}
