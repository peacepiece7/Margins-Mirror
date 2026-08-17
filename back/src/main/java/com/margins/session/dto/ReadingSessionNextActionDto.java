package com.margins.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadingSessionNextActionDto {
    private String actionId;
    private String label;
    private String detail;
    private Long targetWindowId;
    private Long targetQuestionId;
}
