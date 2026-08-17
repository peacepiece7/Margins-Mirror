package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadingSessionStatsDto {
    private Integer windowCount;
    private Integer questionCount;
    private Integer answeredQuestionCount;
    private Integer messageCount;
    private Integer personaResponseCount;
    private Integer personaCount;
}
