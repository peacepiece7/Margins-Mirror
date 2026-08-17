package com.margins.question.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDto {
    private Long questionId;
    private Long sessionId;
    private Long windowId;
    private String questionText;
    private String questionType;
    private String status;
    private String aiModel;
}
