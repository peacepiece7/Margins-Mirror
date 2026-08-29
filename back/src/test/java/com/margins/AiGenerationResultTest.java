package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationEventPersister;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.GenerationLocale;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.PersistentAiGenerationObserver;
import org.junit.jupiter.api.Test;

class AiGenerationResultTest {

    @Test
    void requiresExplicitLocaleForEveryGenerationTask() {
        assertThatThrownBy(() -> new AiGenerationTask("PERSONA", "v1", "text-v1", null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiGenerationTask(
            "PERSONA", "v1", "text-v1", GenerationLocale.KO, false
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiGenerationTask(
            "BOOK_KNOWLEDGE", "v1", "text-v1", GenerationLocale.EN, false
        )).isInstanceOf(IllegalArgumentException.class);
        AiGenerationTask scoped = new AiGenerationTask(
            "REFLECTION_REFINEMENT", "v1", "text-v1", GenerationLocale.EN
        );
        AiGenerationResult<String> result = AiGenerationResult.completed(
            "value", scoped, "placeholder", "placeholder", AiTokenUsage.NONE, 0,
            "FALLBACK", true
        );
        assertThat(scoped.generationLocale()).isEqualTo(GenerationLocale.EN);
        assertThat(scoped.localeScoped()).isTrue();
        assertThat(result.generationLocale()).isEqualTo(GenerationLocale.EN);
    }

    @Test
    void exposesNoPublicLocaleOmittingTaskOrResultConstructor() {
        assertThat(AiGenerationTask.class.getConstructors())
            .allSatisfy(constructor -> assertThat(constructor.getParameterTypes())
                .contains(GenerationLocale.class));
        assertThat(AiGenerationResult.class.getConstructors())
            .allSatisfy(constructor -> assertThat(constructor.getParameterCount()).isEqualTo(15));
        assertThatThrownBy(() -> AiGenerationResult.completed(
            "value", null, "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false
        )).isInstanceOf(NullPointerException.class);
    }

    @Test
    void preservesCachedInputTokensAcrossProviderAndStoredJsonShapes() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        var providerResponse = objectMapper.readTree("""
            {
              "usage": {
                "input_tokens": 120,
                "input_tokens_details": {"cached_tokens": 80},
                "output_tokens": 30,
                "total_tokens": 150
              }
            }
            """);

        AiTokenUsage usage = AiTokenUsage.fromOpenAi(providerResponse);
        AiTokenUsage roundTrip = AiTokenUsage.fromJson(usage.toJson(objectMapper));

        assertThat(roundTrip).isEqualTo(new AiTokenUsage(120, 80, 30, 150));
        AiGenerationResult<String> result = AiGenerationResult.completed(
            "value",
            new AiGenerationTask("INTERVIEW", "prompt-v1", "schema-v1", GenerationLocale.KO),
            "openai",
            "gpt-test",
            roundTrip,
            42,
            "SUCCESS",
            false
        );
        assertThat(result.cachedInputTokens()).isEqualTo(80);
        assertThat(result.tokenUsage().totalTokens()).isEqualTo(150);
    }

    @Test
    void observerStorageFailureNeverChangesTheProductResult() {
        AiGenerationEventPersister persister = mock(AiGenerationEventPersister.class);
        doThrow(new IllegalStateException("database unavailable")).when(persister).persist(any());
        PersistentAiGenerationObserver observer = new PersistentAiGenerationObserver(persister);
        AiGenerationResult<String> result = AiGenerationResult.completed(
            "reader-visible value",
            new AiGenerationTask("PERSONA", "persona-v1", "text-v1", GenerationLocale.EN),
            "openai",
            "gpt-test",
            AiTokenUsage.NONE,
            10,
            "SUCCESS",
            false
        );

        assertThatCode(() -> observer.observe(result, "SIMPLE", false))
            .doesNotThrowAnyException();
        assertThat(result.value()).isEqualTo("reader-visible value");
    }

    @Test
    void coercesUnknownFailureCategoriesWithoutRetainingProviderText() {
        AiGenerationResult<String> result = AiGenerationResult.failure(
            new AiGenerationTask(
                "DISCUSSION_GUIDE", "guide-v1", "schema-v1", GenerationLocale.KO
            ),
            "openai",
            "gpt-test",
            AiTokenUsage.NONE,
            10,
            "provider said the private source was invalid"
        );

        assertThat(result.failureCategory()).isEqualTo("UNCLASSIFIED");
    }
}
