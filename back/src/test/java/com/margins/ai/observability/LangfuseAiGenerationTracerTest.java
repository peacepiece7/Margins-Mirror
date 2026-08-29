package com.margins.ai.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationEventPersister;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.GenerationLocale;
import com.margins.ai.PersistentAiGenerationObserver;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.Test;

class LangfuseAiGenerationTracerTest {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void mapsRawFreeGenerationMetadataAndExclusiveCachedUsage() throws Exception {
        RecordingSpanExporter exporter = new RecordingSpanExporter();
        LangfuseAiGenerationTracer tracer = new LangfuseAiGenerationTracer(
            configuredProperties(),
            OBJECT_MAPPER,
            exporter
        );
        String rawValue = "private-reader-text@example.com";

        String traceId = tracer.trace(
            new AiGenerationResult<>(
                rawValue,
                "DISCUSSION_GUIDE",
                "openai",
                "gpt-5.6-luna",
                "guide-prompt-v2",
                "guide-schema-v3",
                100,
                30,
                20,
                42,
                "SUCCESS",
                false,
                null,
                GenerationLocale.KO,
                null
            ),
            "DEEP",
            true,
            new AiTraceContext(77L, 88L)
        );

        assertThat(tracer.flush(Duration.ofSeconds(1))).isTrue();
        assertThat(traceId).matches("[0-9a-f]{32}");
        assertThat(exporter.spans).hasSize(1);
        SpanData span = exporter.spans.getFirst();
        assertThat(span.getName()).isEqualTo("ai-discussion-guide");
        assertThat(string(span, "langfuse.trace.name")).isEqualTo("ai-discussion-guide");
        assertThat(string(span, "langfuse.observation.type")).isEqualTo("generation");
        assertThat(string(span, "langfuse.observation.model.name")).isEqualTo("gpt-5.6-luna");
        assertThat(string(span, "langfuse.environment")).isEqualTo("local");
        assertThat(string(span, "langfuse.user.id"))
            .startsWith("user_")
            .isNotEqualTo("77");
        assertThat(string(span, "langfuse.session.id"))
            .startsWith("session_")
            .isNotEqualTo("88");
        assertThat(stringList(span, "langfuse.trace.tags"))
            .containsExactly("ai-generation", "discussion-guide");
        assertThat(span.getStatus().getStatusCode()).isEqualTo(StatusCode.OK);
        assertThat(span.getEndEpochNanos() - span.getStartEpochNanos())
            .isEqualTo(Duration.ofMillis(42).toNanos());

        JsonNode input = OBJECT_MAPPER.readTree(string(span, "langfuse.observation.input"));
        assertThat(input.path("taskType").asText()).isEqualTo("DISCUSSION_GUIDE");
        assertThat(input.path("depth").asText()).isEqualTo("DEEP");
        assertThat(input.path("testData").asBoolean()).isTrue();

        JsonNode output = OBJECT_MAPPER.readTree(string(span, "langfuse.observation.output"));
        assertThat(output.path("outcome").asText()).isEqualTo("SUCCESS");
        assertThat(output.path("fallbackUsed").asBoolean()).isFalse();

        JsonNode usage = OBJECT_MAPPER.readTree(string(span, "langfuse.observation.usage_details"));
        assertThat(usage.path("input").asLong()).isEqualTo(70);
        assertThat(usage.path("input_cached_tokens").asLong()).isEqualTo(30);
        assertThat(usage.path("output").asLong()).isEqualTo(20);
        assertThat(usage.path("total").asLong()).isEqualTo(120);

        assertThat(span.getAttributes().asMap().values())
            .allSatisfy(value -> assertThat(String.valueOf(value)).doesNotContain(rawValue));
        tracer.shutdown();
    }

    @Test
    void marksFailuresWithoutSerializingTheResultValue() throws Exception {
        RecordingSpanExporter exporter = new RecordingSpanExporter();
        LangfuseAiGenerationTracer tracer = new LangfuseAiGenerationTracer(
            configuredProperties(),
            OBJECT_MAPPER,
            exporter
        );

        tracer.trace(
            new AiGenerationResult<>(
                "raw-provider-output",
                "REFLECTION_REFINEMENT",
                "openai",
                "gpt-5.6-luna",
                "reflection-v1",
                "none",
                0,
                0,
                0,
                7,
                "FAILURE",
                false,
                "TIMEOUT",
                null,
                null
            ),
            null,
            false
        );

        SpanData span = exporter.spans.getFirst();
        assertThat(span.getStatus().getStatusCode()).isEqualTo(StatusCode.ERROR);
        assertThat(string(span, "langfuse.observation.level")).isEqualTo("ERROR");
        assertThat(string(span, "langfuse.observation.status_message")).isEqualTo("TIMEOUT");
        assertThat(string(span, "langfuse.observation.metadata.generation_locale"))
            .isEqualTo("none");
        assertThat(string(span, "langfuse.observation.output"))
            .contains("TIMEOUT")
            .doesNotContain("raw-provider-output");
        tracer.shutdown();
    }

    @Test
    void missingCredentialsUseNoOpWithoutCreatingSpans() {
        RecordingSpanExporter exporter = new RecordingSpanExporter();
        LangfuseAiGenerationTracer tracer = new LangfuseAiGenerationTracer(
            new LangfuseProperties(),
            OBJECT_MAPPER,
            exporter
        );

        assertThat(tracer.trace(result(), null, false)).isNull();
        assertThat(tracer.flush(Duration.ofMillis(10))).isTrue();
        assertThat(exporter.spans).isEmpty();
    }

    @Test
    void invalidConfiguredEnvironmentFailsWithoutExposingCredentials() {
        LangfuseProperties properties = configuredProperties();
        properties.setEnvironment("Langfuse Production");

        assertThatThrownBy(() -> properties.validate())
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("LANGFUSE_TRACING_ENVIRONMENT is invalid")
            .hasMessageNotContaining(properties.getSecretKey());
    }

    @Test
    void partialCredentialsFailWithoutExposingTheConfiguredKey() {
        LangfuseProperties properties = new LangfuseProperties();
        properties.setPublicKey("pk-lf-sensitive-test-value");

        assertThatThrownBy(() -> properties.validate())
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage(
                "LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must be configured together"
            )
            .hasMessageNotContaining(properties.getPublicKey());
    }

    @Test
    void configuredCredentialsRequireABaseUrl() {
        LangfuseProperties properties = configuredProperties();
        properties.setBaseUrl(" ");

        assertThatThrownBy(() -> properties.validate())
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("LANGFUSE_BASE_URL is required when credentials are configured")
            .hasMessageNotContaining(properties.getSecretKey());
    }

    @Test
    void defaultConfiguredEndpointUsesTheJapanRegion() {
        LangfuseProperties properties = new LangfuseProperties();
        properties.setPublicKey("pk-lf-test");
        properties.setSecretKey("sk-lf-test");

        properties.validate();

        assertThat(properties.tracesEndpoint().toString())
            .isEqualTo("https://jp.cloud.langfuse.com/api/public/otel/v1/traces");
    }

    @Test
    void rejectsPlainHttpBeforeCredentialsCanBeTransmitted() {
        LangfuseProperties properties = configuredProperties();
        properties.setBaseUrl("http://localhost:3000");

        assertThatThrownBy(() -> properties.validate())
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("LANGFUSE_BASE_URL must be an HTTPS origin")
            .hasMessageNotContaining(properties.getSecretKey());
    }

    @Test
    void pseudonymousIdentifiersAreStableWithinTheProjectAndDomainSeparated() {
        RecordingSpanExporter exporter = new RecordingSpanExporter();
        LangfuseAiGenerationTracer tracer = new LangfuseAiGenerationTracer(
            configuredProperties(),
            OBJECT_MAPPER,
            exporter
        );

        tracer.trace(result(), null, false, new AiTraceContext(99L, 99L));
        tracer.trace(result(), null, false, new AiTraceContext(99L, 99L));

        SpanData first = exporter.spans.get(0);
        SpanData second = exporter.spans.get(1);
        assertThat(string(first, "langfuse.user.id"))
            .isEqualTo(string(second, "langfuse.user.id"))
            .isNotEqualTo(string(first, "langfuse.session.id"));
        assertThat(string(first, "langfuse.session.id"))
            .isEqualTo(string(second, "langfuse.session.id"));
        tracer.shutdown();
    }

    @Test
    void externalTraceFailureDoesNotBlockExistingPersistenceObserver() {
        AiGenerationEventPersister persister = mock(AiGenerationEventPersister.class);
        AiGenerationTraceSink failingSink = (result, depth, testData) -> {
            throw new IllegalStateException("exporter unavailable");
        };
        PersistentAiGenerationObserver observer = new PersistentAiGenerationObserver(
            persister,
            failingSink
        );

        assertThatCode(() -> observer.observe(result(), "SIMPLE", false))
            .doesNotThrowAnyException();
        verify(persister).persist(org.mockito.ArgumentMatchers.any());
    }

    private static LangfuseProperties configuredProperties() {
        LangfuseProperties properties = new LangfuseProperties();
        properties.setPublicKey("pk-lf-test");
        properties.setSecretKey("sk-lf-test");
        properties.setBaseUrl("https://jp.cloud.langfuse.com");
        properties.setEnvironment("local");
        properties.setRelease("test-release");
        return properties;
    }

    private static AiGenerationResult<String> result() {
        return new AiGenerationResult<>(
            "not-exported",
            "QUESTION_GENERATION",
            "openai",
            "gpt-5.6-luna",
            "question-v1",
            "question-schema-v1",
            10,
            2,
            4,
            12,
            "SUCCESS",
            false,
            null,
            GenerationLocale.KO,
            null
        );
    }

    private static String string(SpanData span, String key) {
        return span.getAttributes().get(AttributeKey.stringKey(key));
    }

    private static List<String> stringList(SpanData span, String key) {
        return span.getAttributes().get(AttributeKey.stringArrayKey(key));
    }

    private static final class RecordingSpanExporter implements SpanExporter {
        private final List<SpanData> spans = new ArrayList<>();

        @Override
        public CompletableResultCode export(Collection<SpanData> spans) {
            this.spans.addAll(spans);
            return CompletableResultCode.ofSuccess();
        }

        @Override
        public CompletableResultCode flush() {
            return CompletableResultCode.ofSuccess();
        }

        @Override
        public CompletableResultCode shutdown() {
            return CompletableResultCode.ofSuccess();
        }
    }
}
