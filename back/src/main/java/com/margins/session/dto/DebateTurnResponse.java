package com.margins.session.dto;

import com.margins.moderation.dto.ModerationEventDto;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DebateTurnResponse {
    private ModerationEventDto moderation;
    @Builder.Default
    private List<AiMessageResponse> messages = List.of();
}
