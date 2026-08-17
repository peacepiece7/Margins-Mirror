package com.margins.moderation;

import com.margins.ai.OpenAiProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
/** Moderator 활성화 시 기존 OpenAI credential이 있는지 startup에 검증한다. */
public class ModeratorRuntimeValidator {
    private final ModerationProperties moderationProperties;
    private final OpenAiProperties openAiProperties;

    @PostConstruct
    void validate() {
        if (!moderationProperties.isEnabled()) {
            return;
        }
        if (isBlank(openAiProperties.getApiKey())) {
            throw new IllegalStateException(
                "OPENAI_API_KEY is required when AI Moderator is enabled"
            );
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
