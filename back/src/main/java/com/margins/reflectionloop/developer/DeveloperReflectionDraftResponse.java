package com.margins.reflectionloop.developer;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DeveloperReflectionDraftResponse {
    String content;
    String model;
    List<PersonaSummary> personas;

    @Value
    @Builder
    public static class PersonaSummary {
        Long personaId;
        String displayName;
    }
}
