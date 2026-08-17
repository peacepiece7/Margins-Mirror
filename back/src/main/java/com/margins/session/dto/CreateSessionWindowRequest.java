package com.margins.session.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class CreateSessionWindowRequest {
    @NotNull
    Long sessionId;
    @NotBlank
    @Size(max = 40)
    String windowType;
    @NotBlank
    @Size(max = 255)
    String title;
    @Size(max = 2)
    List<Long> personaIds;
}
