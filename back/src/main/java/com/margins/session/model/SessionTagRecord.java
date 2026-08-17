package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionTagRecord {
    private Long id;
    private Long sessionId;
    private Long userId;
    private String label;
    private boolean testData;
}
