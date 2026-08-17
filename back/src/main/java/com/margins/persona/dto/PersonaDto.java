package com.margins.persona.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonaDto {
    private Long personaId;
    private String name;
    private String displayName;
    private String description;
    private String tone;
}
