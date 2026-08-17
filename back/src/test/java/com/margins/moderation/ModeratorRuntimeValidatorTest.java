package com.margins.moderation;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.ai.OpenAiProperties;
import org.junit.jupiter.api.Test;

class ModeratorRuntimeValidatorTest {

    @Test
    void disabledModeratorNeedsNoSecrets() {
        assertThatCode(() -> new ModeratorRuntimeValidator(
            new ModerationProperties(),
            new OpenAiProperties()
        ).validate()).doesNotThrowAnyException();
    }

    @Test
    void enabledModeratorRequiresExistingOpenAiApiKey() {
        ModerationProperties moderation = new ModerationProperties();
        moderation.setEnabled(true);
        OpenAiProperties openAi = new OpenAiProperties();

        assertThatThrownBy(() -> new ModeratorRuntimeValidator(moderation, openAi).validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("OPENAI_API_KEY")
            .hasMessageNotContaining("test-key");

        openAi.setApiKey("test-key");
        assertThatCode(() -> new ModeratorRuntimeValidator(moderation, openAi).validate())
            .doesNotThrowAnyException();
    }
}
