package com.margins.reflectionloop.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiProvider;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.SendMessageRequest;
import org.junit.jupiter.api.Test;

class ReflectionRefinementAssistantTest {

    @Test
    void providerFallbackWithPlaceholderContentBecomesFailedWithoutPersistableValue() {
        AiProvider provider = mock(AiProvider.class);
        AiGenerationTask task = new AiGenerationTask(
            "REFLECTION_REFINEMENT",
            "reflection-refinement-v1",
            "text-v1",
            GenerationLocale.EN
        );
        AiMessageResponse response = AiMessageResponse.builder()
            .content("placeholder refinement")
            .aiModel("placeholder")
            .build();
        when(provider.answerWindowMessageWithMetadata(any(), any(SendMessageRequest.class), any()))
            .thenReturn(AiGenerationResult.completed(
                response,
                task,
                "placeholder",
                "placeholder",
                AiTokenUsage.NONE,
                1,
                "FALLBACK",
                true
            ));

        ReflectionRefinementAssistant assistant = new ReflectionRefinementAssistant(provider);
        AiGenerationResult<String> result = assistant.suggestWithMetadata(
            11L,
            "Current reflection",
            "Discussion perspective",
            task.promptVersion(),
            null,
            true,
            GenerationLocale.EN
        );

        assertThat(result.value()).isNull();
        assertThat(result.outcome()).isEqualTo("FAILURE");
        assertThat(result.fallbackUsed()).isFalse();
    }
}
