package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class GuidedDiscussionTurnRequest {
    @Size(max = 12000)
    String content;
    Long personaId;
    @Pattern(regexp = "RESPOND|NEXT|FINISH|SELECT_PERSPECTIVE|SKIP_PERSPECTIVE")
    String navigation;

    @AssertTrue(message = "content is required unless selecting a perspective")
    public boolean isContentValidForNavigation() {
        if ("SELECT_PERSPECTIVE".equals(navigation)) {
            return personaId != null;
        }
        if ("SKIP_PERSPECTIVE".equals(navigation)) {
            return true;
        }
        return content != null && !content.isBlank();
    }
}
