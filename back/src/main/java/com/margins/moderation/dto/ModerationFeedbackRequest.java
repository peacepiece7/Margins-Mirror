package com.margins.moderation.dto;

import com.margins.moderation.ModerationFeedback;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class ModerationFeedbackRequest {
    @NotNull
    ModerationFeedback feedback;
}
