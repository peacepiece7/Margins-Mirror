package com.margins.persona.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonaRecord {
    private Long id;
    private Long createdByUserId;
    private boolean shared;
    private String name;
    private String displayName;
    private String description;
    private String systemPrompt;
    private String tone;
    private boolean active;
}
