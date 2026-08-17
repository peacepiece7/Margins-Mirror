package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class RegenerateDiscussionGuideRequest {
    @NotNull
    @Min(1)
    Integer expectedVersion;
    @NotNull
    @Valid
    GuideBriefRequest brief;
}
