package com.margins.ai.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.OpenAiProperties;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** OpenAI Responses wire protocol boundary without product-specific fallback policy. */
@Component
@RequiredArgsConstructor
public class OpenAiResponsesTransport {

    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public TextResponse execute(ObjectNode requestBody) {
        try {
            HttpRequest request = requestBuilder(requestBody)
                .header("Accept", "application/json")
                .build();
            HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            requireSuccess(response.statusCode(), false);

            ParsedBody parsed = parseTextResponseBody(response);
            String status = sanitizedMetadata(parsed.body().path("status"));
            String incompleteReason = sanitizedMetadata(
                parsed.body().path("incomplete_details").path("reason")
            );
            String outputText = extractOutputText(parsed.body()).trim();
            if (outputText.isBlank() && (status.isBlank() || "completed".equals(status))) {
                throw new IllegalStateException("OpenAI response did not include text output");
            }
            AiTokenUsage usage = parsed.streamUsage() == null
                ? AiTokenUsage.fromOpenAi(parsed.body())
                : parsed.streamUsage();
            return new TextResponse(
                status,
                incompleteReason,
                outputText,
                usage
            );
        } catch (IOException exception) {
            throw OpenAiResponsesException.requestFailure(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw OpenAiResponsesException.interrupted(exception);
        }
    }

    public StreamResponse executeStream(ObjectNode requestBody, Consumer<String> deltaConsumer) {
        try {
            HttpRequest request = requestBuilder(requestBody)
                .header("Accept", "text/event-stream")
                .build();
            HttpResponse<InputStream> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofInputStream()
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                response.body().close();
            }
            requireSuccess(response.statusCode(), true);

            StreamAccumulator result = readStreamedOutput(response.body(), deltaConsumer);
            String outputText = result.outputText().trim();
            if (outputText.isBlank()) {
                throw new IllegalStateException("OpenAI stream did not include text output");
            }
            return new StreamResponse(outputText, result.tokenUsage());
        } catch (IOException exception) {
            throw OpenAiResponsesException.streamFailure(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw OpenAiResponsesException.streamInterrupted(exception);
        }
    }

    private HttpRequest.Builder requestBuilder(ObjectNode requestBody) throws IOException {
        return HttpRequest.newBuilder()
            .uri(URI.create(properties.getBaseUrl() + "/responses"))
            .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
            .header("Authorization", "Bearer " + properties.getApiKey())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(
                objectMapper.writeValueAsString(requestBody),
                StandardCharsets.UTF_8
            ));
    }

    private void requireSuccess(int statusCode, boolean streaming) {
        if (statusCode < 200 || statusCode >= 300) {
            String operation = streaming ? "stream request" : "request";
            throw new IllegalStateException("OpenAI " + operation + " failed: " + statusCode);
        }
    }

    private ParsedBody parseTextResponseBody(HttpResponse<String> response) {
        String body = response.body();
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("OpenAI response body was empty. status="
                + response.statusCode()
                + ", contentType="
                + responseContentType(response)
                + ", bodyLength=0");
        }

        try {
            return new ParsedBody(objectMapper.readTree(body), null);
        } catch (IOException jsonException) {
            if (looksLikeEventStream(body)) {
                try {
                    StreamAccumulator streamed = readStreamedOutput(
                        new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)),
                        ignored -> {
                        }
                    );
                    ObjectNode root = objectMapper.createObjectNode();
                    root.put("output_text", streamed.outputText());
                    return new ParsedBody(root, streamed.tokenUsage());
                } catch (IOException streamException) {
                    throw malformedTextResponse(response);
                }
            }
            throw malformedTextResponse(response);
        }
    }

    private StreamAccumulator readStreamedOutput(
        InputStream inputStream,
        Consumer<String> deltaConsumer
    ) throws IOException {
        StringBuilder output = new StringBuilder();
        StringBuilder eventData = new StringBuilder();
        AtomicReference<AiTokenUsage> usage = new AtomicReference<>(AiTokenUsage.NONE);
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(inputStream, StandardCharsets.UTF_8)
        )) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    appendStreamEvent(eventData.toString(), output, deltaConsumer, usage);
                    eventData.setLength(0);
                } else if (line.startsWith("data:")) {
                    if (!eventData.isEmpty()) {
                        eventData.append('\n');
                    }
                    eventData.append(line.substring(5).trim());
                }
            }
        }
        appendStreamEvent(eventData.toString(), output, deltaConsumer, usage);
        return new StreamAccumulator(output.toString(), usage.get());
    }

    private void appendStreamEvent(
        String data,
        StringBuilder output,
        Consumer<String> deltaConsumer,
        AtomicReference<AiTokenUsage> usage
    ) throws IOException {
        if (data.isBlank() || "[DONE]".equals(data)) {
            return;
        }

        JsonNode event;
        try {
            event = objectMapper.readTree(data);
        } catch (IOException exception) {
            throw new IOException("OpenAI stream event could not be parsed");
        }
        if ("error".equals(event.path("type").asText())) {
            throw new IllegalStateException("OpenAI stream failed");
        }
        if ("response.completed".equals(event.path("type").asText())) {
            usage.set(AiTokenUsage.fromOpenAi(event.path("response")));
        }

        String delta = extractStreamDelta(event);
        if (!delta.isEmpty()) {
            output.append(delta);
            deltaConsumer.accept(delta);
        }
    }

    private String extractStreamDelta(JsonNode event) {
        String type = event.path("type").asText();
        if ("response.output_text.delta".equals(type) && event.hasNonNull("delta")) {
            return event.path("delta").asText();
        }
        if (type.endsWith(".delta") && event.hasNonNull("text")) {
            return event.path("text").asText();
        }
        return "";
    }

    private String extractOutputText(JsonNode root) {
        if (containsRefusal(root)) {
            throw new IllegalStateException("OpenAI response refused");
        }
        if (root.hasNonNull("output_text")) {
            return root.path("output_text").asText();
        }
        StringBuilder output = new StringBuilder();
        appendOutputText(root, output);
        return output.toString();
    }

    private boolean containsRefusal(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return false;
        }
        if (node.isObject() && "refusal".equals(node.path("type").asText())) {
            return true;
        }
        if (node.isContainerNode()) {
            for (JsonNode child : node) {
                if (containsRefusal(child)) {
                    return true;
                }
            }
        }
        return false;
    }

    private void appendOutputText(JsonNode node, StringBuilder output) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return;
        }
        if (node.isObject()
            && "output_text".equals(node.path("type").asText())
            && node.hasNonNull("text")) {
            output.append(node.path("text").asText());
        }
        if (node.isContainerNode()) {
            node.forEach(child -> appendOutputText(child, output));
        }
    }

    private boolean looksLikeEventStream(String body) {
        return body.stripLeading().startsWith("data:");
    }

    private IllegalStateException malformedTextResponse(HttpResponse<String> response) {
        int bodyLength = response.body() == null ? 0 : response.body().length();
        return new IllegalStateException("OpenAI response could not be parsed. status="
            + response.statusCode()
            + ", contentType="
            + responseContentType(response)
            + ", bodyLength="
            + bodyLength);
    }

    private String responseContentType(HttpResponse<?> response) {
        return response.headers().firstValue("content-type").orElse("");
    }

    private String sanitizedMetadata(JsonNode value) {
        if (!value.isTextual()) {
            return "";
        }
        String normalized = value.asText("").trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "";
        }
        if (normalized.length() > 64 || !normalized.matches("[a-z0-9_-]+")) {
            return "unknown";
        }
        return normalized;
    }

    public record TextResponse(
        String status,
        String incompleteReason,
        String outputText,
        AiTokenUsage tokenUsage
    ) {
    }

    public record StreamResponse(
        String outputText,
        AiTokenUsage tokenUsage
    ) {
    }

    public static final class OpenAiResponsesException extends IllegalStateException {
        private final boolean timeout;

        private OpenAiResponsesException(
            String message,
            Throwable cause,
            boolean timeout
        ) {
            super(message, cause);
            this.timeout = timeout;
        }

        public boolean isTimeout() {
            return timeout;
        }

        private static OpenAiResponsesException requestFailure(IOException cause) {
            return new OpenAiResponsesException(
                "OpenAI request could not be completed",
                cause,
                cause instanceof HttpTimeoutException
            );
        }

        private static OpenAiResponsesException interrupted(InterruptedException cause) {
            return new OpenAiResponsesException(
                "OpenAI request interrupted",
                cause,
                false
            );
        }

        private static OpenAiResponsesException streamFailure(IOException cause) {
            return new OpenAiResponsesException(
                "OpenAI stream could not be parsed",
                cause,
                cause instanceof HttpTimeoutException
            );
        }

        private static OpenAiResponsesException streamInterrupted(
            InterruptedException cause
        ) {
            return new OpenAiResponsesException(
                "OpenAI stream request interrupted",
                cause,
                false
            );
        }
    }

    private record ParsedBody(
        JsonNode body,
        AiTokenUsage streamUsage
    ) {
    }

    private record StreamAccumulator(
        String outputText,
        AiTokenUsage tokenUsage
    ) {
    }
}
