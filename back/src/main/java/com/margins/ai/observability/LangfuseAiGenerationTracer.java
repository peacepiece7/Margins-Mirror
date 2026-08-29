package com.margins.ai.observability;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.ai.AiGenerationResult;
import com.margins.common.support.RequestCorrelationContext;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanBuilder;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import jakarta.annotation.PreDestroy;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Isolated OTLP exporter that emits only explicit, raw-free AI generation observations. */
@Component
@Slf4j
public class LangfuseAiGenerationTracer implements AiGenerationTraceSink {
    private static final String INSTRUMENTATION_SCOPE = "com.margins.ai.observability";
    private static final AttributeKey<List<String>> TRACE_TAGS =
        AttributeKey.stringArrayKey("langfuse.trace.tags");

    private final LangfuseProperties properties;
    private final ObjectMapper objectMapper;
    private final SdkTracerProvider tracerProvider;
    private final Tracer tracer;

    @Autowired
    public LangfuseAiGenerationTracer(
        LangfuseProperties properties,
        ObjectMapper objectMapper
    ) {
        this(properties, objectMapper, null);
    }

    LangfuseAiGenerationTracer(
        LangfuseProperties properties,
        ObjectMapper objectMapper,
        SpanExporter testExporter
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        properties.validate();
        if (!properties.configured()) {
            this.tracerProvider = null;
            this.tracer = OpenTelemetry.noop().getTracer(INSTRUMENTATION_SCOPE);
            log.info("Langfuse tracing is inactive because credentials are not configured");
            return;
        }

        SpanExporter exporter = testExporter == null ? otlpExporter(properties) : testExporter;
        var providerBuilder = SdkTracerProvider.builder()
            .setSampler(Sampler.traceIdRatioBased(properties.getSampleRate()))
            .setResource(Resource.create(Attributes.builder()
                .put("service.name", "margins-back")
                .put("service.version", normalized(properties.getRelease(), "local"))
                .put("langfuse.environment", properties.getEnvironment())
                .build()));
        if (testExporter == null) {
            providerBuilder.addSpanProcessor(BatchSpanProcessor.create(exporter));
        } else {
            providerBuilder.addSpanProcessor(SimpleSpanProcessor.create(exporter));
        }
        this.tracerProvider = providerBuilder.build();
        this.tracer = tracerProvider.get(INSTRUMENTATION_SCOPE);
        log.info(
            "Langfuse tracing configured environment={} sampleRate={}",
            properties.getEnvironment(),
            properties.getSampleRate()
        );
    }

    @Override
    public String trace(AiGenerationResult<?> result, String depth, boolean testData) {
        return trace(result, depth, testData, AiTraceContext.EMPTY);
    }

    @Override
    public String trace(
        AiGenerationResult<?> result,
        String depth,
        boolean testData,
        AiTraceContext traceContext
    ) {
        if (result == null || tracerProvider == null) {
            return null;
        }

        Instant endedAt = Instant.now();
        long endEpochNanos = epochNanos(endedAt);
        long startEpochNanos = endEpochNanos - TimeUnit.MILLISECONDS.toNanos(result.latencyMs());
        String operationName = operationName(result.taskType());
        SpanBuilder spanBuilder = tracer.spanBuilder(operationName)
            .setNoParent()
            .setStartTimestamp(startEpochNanos, TimeUnit.NANOSECONDS);
        Span span = spanBuilder.startSpan();
        try {
            applyTraceAttributes(span, result, operationName, depth, testData, traceContext);
            applyGenerationAttributes(span, result, depth, testData);
            applyStatus(span, result);
            return span.getSpanContext().getTraceId();
        } finally {
            span.end(endEpochNanos, TimeUnit.NANOSECONDS);
        }
    }

    @Override
    public boolean flush(Duration timeout) {
        if (tracerProvider == null) {
            return true;
        }
        return completed(tracerProvider.forceFlush(), timeout);
    }

    @PreDestroy
    public void shutdown() {
        if (tracerProvider == null) {
            return;
        }
        Duration timeout = Duration.ofSeconds(properties.getExportTimeoutSeconds());
        if (!completed(tracerProvider.shutdown(), timeout)) {
            log.warn("Langfuse tracer shutdown timed out");
        }
    }

    private void applyTraceAttributes(
        Span span,
        AiGenerationResult<?> result,
        String operationName,
        String depth,
        boolean testData,
        AiTraceContext traceContext
    ) {
        span.setAttribute("langfuse.trace.name", operationName);
        span.setAttribute(TRACE_TAGS, List.of("ai-generation", tag(result.taskType())));
        span.setAttribute("langfuse.environment", properties.getEnvironment());
        span.setAttribute("langfuse.release", normalized(properties.getRelease(), "local"));
        traceMetadata(span, "feature", tag(result.taskType()));
        traceMetadata(span, "provider", result.provider());
        traceMetadata(span, "outcome", result.outcome());
        traceMetadata(span, "test_data", Boolean.toString(testData));
        traceMetadata(span, "depth", normalized(depth, "none"));
        applyPseudonymousIdentity(span, traceContext);
        RequestCorrelationContext.current()
            .ifPresent(value -> traceMetadata(span, "correlation_id", value));
    }

    private void applyGenerationAttributes(
        Span span,
        AiGenerationResult<?> result,
        String depth,
        boolean testData
    ) {
        span.setAttribute("langfuse.observation.type", "generation");
        span.setAttribute("langfuse.observation.model.name", result.model());
        span.setAttribute("langfuse.observation.input", input(result, depth, testData).toString());
        span.setAttribute("langfuse.observation.output", output(result).toString());
        span.setAttribute("langfuse.observation.usage_details", usage(result).toString());
        span.setAttribute("langfuse.version", result.promptVersion());
        span.setAttribute("gen_ai.system", result.provider());
        span.setAttribute("gen_ai.request.model", result.model());
        observationMetadata(span, "task_type", result.taskType());
        observationMetadata(span, "provider", result.provider());
        observationMetadata(span, "prompt_version", result.promptVersion());
        observationMetadata(span, "schema_version", result.schemaVersion());
        observationMetadata(span, "outcome", result.outcome());
        observationMetadata(span, "fallback_used", Boolean.toString(result.fallbackUsed()));
        observationMetadata(span, "failure_category", normalized(result.failureCategory(), "none"));
        observationMetadata(span, "generation_locale", generationLocale(result));
        observationMetadata(
            span,
            "language_validation",
            result.languageValidationOutcome() == null
                ? "none"
                : result.languageValidationOutcome().name()
        );
    }

    private void applyStatus(Span span, AiGenerationResult<?> result) {
        if ("FAILURE".equalsIgnoreCase(result.outcome())) {
            String failure = normalized(result.failureCategory(), "UNCLASSIFIED");
            span.setStatus(StatusCode.ERROR, failure);
            span.setAttribute("langfuse.observation.level", "ERROR");
            span.setAttribute("langfuse.observation.status_message", failure);
            return;
        }
        if (result.fallbackUsed() || "FALLBACK".equalsIgnoreCase(result.outcome())) {
            span.setAttribute("langfuse.observation.level", "WARNING");
            span.setAttribute("langfuse.observation.status_message", "fallback");
            return;
        }
        span.setStatus(StatusCode.OK);
        span.setAttribute("langfuse.observation.level", "DEFAULT");
    }

    private ObjectNode input(AiGenerationResult<?> result, String depth, boolean testData) {
        ObjectNode input = objectMapper.createObjectNode();
        input.put("taskType", result.taskType());
        input.put("promptVersion", result.promptVersion());
        input.put("schemaVersion", result.schemaVersion());
        input.put("generationLocale", generationLocale(result));
        input.put("depth", normalized(depth, "none"));
        input.put("testData", testData);
        return input;
    }

    private ObjectNode output(AiGenerationResult<?> result) {
        ObjectNode output = objectMapper.createObjectNode();
        output.put("outcome", result.outcome());
        output.put("fallbackUsed", result.fallbackUsed());
        if (result.failureCategory() != null) {
            output.put("failureCategory", result.failureCategory());
        }
        if (result.languageValidationOutcome() != null) {
            output.put("languageValidationOutcome", result.languageValidationOutcome().name());
        }
        return output;
    }

    private ObjectNode usage(AiGenerationResult<?> result) {
        long cachedInput = Math.min(result.inputTokens(), result.cachedInputTokens());
        ObjectNode usage = objectMapper.createObjectNode();
        usage.put("input", result.inputTokens() - cachedInput);
        usage.put("input_cached_tokens", cachedInput);
        usage.put("output", result.outputTokens());
        usage.put("total", result.inputTokens() + result.outputTokens());
        return usage;
    }

    private void traceMetadata(Span span, String key, String value) {
        span.setAttribute("langfuse.trace.metadata." + key, normalized(value, "none"));
    }

    private void observationMetadata(Span span, String key, String value) {
        span.setAttribute("langfuse.observation.metadata." + key, normalized(value, "none"));
    }

    private void applyPseudonymousIdentity(Span span, AiTraceContext traceContext) {
        if (traceContext == null) {
            return;
        }
        if (traceContext.userId() != null) {
            span.setAttribute("langfuse.user.id", pseudonym("user", traceContext.userId()));
        }
        if (traceContext.sessionId() != null) {
            span.setAttribute(
                "langfuse.session.id",
                pseudonym("session", traceContext.sessionId())
            );
        }
    }

    private String pseudonym(String namespace, long identifier) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                properties.getSecretKey().getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
            ));
            byte[] digest = mac.doFinal(
                ("margins:" + namespace + ":" + identifier).getBytes(StandardCharsets.UTF_8)
            );
            return namespace + "_" + HexFormat.of().formatHex(digest, 0, 16);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Trace identifier pseudonymization failed", exception);
        }
    }

    private String operationName(String taskType) {
        return "ai-" + tag(taskType);
    }

    private String tag(String value) {
        String sanitized = normalized(value, "unknown")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-+|-+$)", "");
        return sanitized.isBlank() ? "unknown" : sanitized;
    }

    private String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String generationLocale(AiGenerationResult<?> result) {
        return result.generationLocale() == null ? "none" : result.generationLocale().value();
    }

    private long epochNanos(Instant instant) {
        return TimeUnit.SECONDS.toNanos(instant.getEpochSecond()) + instant.getNano();
    }

    private boolean completed(CompletableResultCode result, Duration timeout) {
        return result.join(timeout.toMillis(), TimeUnit.MILLISECONDS).isSuccess();
    }

    private SpanExporter otlpExporter(LangfuseProperties config) {
        String credentials = config.getPublicKey() + ":" + config.getSecretKey();
        String authorization = "Basic " + Base64.getEncoder().encodeToString(
            credentials.getBytes(StandardCharsets.UTF_8)
        );
        return OtlpHttpSpanExporter.builder()
            .setEndpoint(config.tracesEndpoint().toString())
            .addHeader("Authorization", authorization)
            .addHeader("x-langfuse-ingestion-version", "4")
            .setTimeout(Duration.ofSeconds(config.getExportTimeoutSeconds()))
            .build();
    }
}
