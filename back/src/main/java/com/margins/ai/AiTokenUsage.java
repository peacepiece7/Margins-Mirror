package com.margins.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;

/** Provider-reported token usage. Missing usage remains an all-zero unknown value. */
public record AiTokenUsage(
    long inputTokens,
    long cachedInputTokens,
    long outputTokens,
    long totalTokens
) {
    private static final ObjectMapper CODEC = new ObjectMapper();
    public static final AiTokenUsage NONE = new AiTokenUsage(0, 0, 0, 0);

    public AiTokenUsage {
        inputTokens = nonNegative(inputTokens);
        cachedInputTokens = nonNegative(cachedInputTokens);
        outputTokens = nonNegative(outputTokens);
        totalTokens = nonNegative(totalTokens);
    }

    public static AiTokenUsage fromOpenAi(JsonNode responseBody) {
        if (responseBody == null) {
            return NONE;
        }
        JsonNode usage = responseBody.path("usage");
        if (!usage.isObject()) {
            return NONE;
        }
        return new AiTokenUsage(
            usage.path("input_tokens").asLong(0),
            usage.path("input_tokens_details").path("cached_tokens").asLong(0),
            usage.path("output_tokens").asLong(0),
            usage.path("total_tokens").asLong(0)
        );
    }

    public static AiTokenUsage fromJson(String json) {
        if (json == null || json.isBlank()) {
            return NONE;
        }
        try {
            JsonNode usage = CODEC.readTree(json);
            if (!usage.isObject()) {
                return NONE;
            }
            return new AiTokenUsage(
                usage.path("inputTokens").asLong(0),
                usage.path("cachedInputTokens").asLong(0),
                usage.path("outputTokens").asLong(0),
                usage.path("totalTokens").asLong(0)
            );
        } catch (IOException exception) {
            return NONE;
        }
    }

    public String toJson(ObjectMapper objectMapper) {
        ObjectNode normalized = objectMapper.createObjectNode();
        normalized.put("inputTokens", inputTokens);
        normalized.put("cachedInputTokens", cachedInputTokens);
        normalized.put("outputTokens", outputTokens);
        normalized.put("totalTokens", totalTokens);
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (IOException exception) {
            throw new IllegalStateException("AI token usage could not be serialized", exception);
        }
    }

    private static long nonNegative(long value) {
        return Math.max(0, value);
    }
}
