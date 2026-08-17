package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionWindowRecord {
    private Long id;
    private Long sessionId;
    private Long userId;
    private Long sourceQuestionId;
    private String windowType;
    private String title;
    private Integer position;
    private String status;
    private boolean testData;
}
