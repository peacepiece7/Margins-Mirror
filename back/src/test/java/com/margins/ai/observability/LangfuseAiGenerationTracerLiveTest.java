package com.margins.ai.observability;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.GenerationLocale;
import java.time.Duration;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@Tag("integration")
@EnabledIfEnvironmentVariable(named = "LANGFUSE_INTEGRATION_TEST_ENABLED", matches = "true")
class LangfuseAiGenerationTracerLiveTest {

    @Test
    void exportsSyntheticRawFreeGenerationToConfiguredLangfuseProject() {
        LangfuseProperties properties = new LangfuseProperties();
        properties.setPublicKey(required("LANGFUSE_PUBLIC_KEY"));
        properties.setSecretKey(required("LANGFUSE_SECRET_KEY"));
        properties.setBaseUrl(required("LANGFUSE_BASE_URL"));
        properties.setEnvironment(System.getenv().getOrDefault(
            "LANGFUSE_TRACING_ENVIRONMENT",
            "local"
        ));
        properties.setRelease("langfuse-observability-live-smoke");
        properties.setExportTimeoutSeconds(15);
        LangfuseAiGenerationTracer tracer = new LangfuseAiGenerationTracer(
            properties,
            new ObjectMapper()
        );

        String traceId = tracer.trace(
            new AiGenerationResult<>(
                "synthetic-value-must-not-be-exported",
                "LANGFUSE_SMOKE",
                "openai",
                "gpt-5.6-luna",
                "langfuse-smoke-v1",
                "none",
                17,
                5,
                9,
                42,
                "SUCCESS",
                false,
                null,
                GenerationLocale.KO,
                null
            ),
            "SIMPLE",
            true,
            new AiTraceContext(7001L, 8001L)
        );

        assertThat(traceId).matches("[0-9a-f]{32}");
        assertThat(tracer.flush(Duration.ofSeconds(15))).isTrue();
        System.out.println("LANGFUSE_TRACE_ID=" + traceId);
        tracer.shutdown();
    }

    private String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value;
    }
}
