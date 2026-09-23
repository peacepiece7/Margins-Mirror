package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionWindowPersonaSelection {
    private Long windowId;
    private Long personaId;
    private Integer selectionOrder;
}
