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
public class ReflectionInterviewAnswerRecord {
    private Long id;
    private Long interviewId;
    private Long questionId;
    private Long sessionInsightId;
    private Long userId;
    private Integer version;
    private String content;
    private String responseMode;
    private String revisionKind;
    private Long sourceAnswerRevisionId;
    private boolean current;
    private boolean testData;
    private LocalDateTime createdAt;
    private String questionText;
}
