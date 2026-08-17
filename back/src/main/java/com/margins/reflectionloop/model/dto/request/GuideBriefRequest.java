package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class GuideBriefRequest {
    @NotNull
    @Pattern(regexp = "THOUGHT_EXPANSION|ISSUE_EXPLORATION|DISCUSSION_PREP")
    String purpose;
    @NotNull
    @Pattern(regexp = "SELF_AI|SMALL_GROUP")
    String audienceMode;
    @NotNull
    Integer targetMinutes;
    @NotNull
    @Pattern(regexp = "PRIVATE_CONTEXT|REFLECTION_ONLY")
    String disclosureMode;
    @Builder.Default
    @Pattern(regexp = "BEGINNER|EXPERIENCED|EXPERT")
    String facilitationLevel = "BEGINNER";

    @AssertTrue
    public boolean isSupportedTargetMinutes() {
        return targetMinutes != null
            && (targetMinutes == 20 || targetMinutes == 40 || targetMinutes == 60);
    }
}
