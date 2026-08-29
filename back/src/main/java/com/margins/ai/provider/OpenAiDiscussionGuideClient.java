package com.margins.ai.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.DiscussionGuideGeneration.Evidence;
import com.margins.ai.DiscussionGuideGeneration.Item;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.DiscussionGuideGeneration.Response;
import com.margins.ai.OpenAiProperties;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.margins.ai.transport.OpenAiResponsesTransport.OpenAiResponsesException;
import com.margins.common.support.RequestCorrelationContext;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "margins.ai.provider", havingValue = "openai")
@Slf4j
public final class OpenAiDiscussionGuideClient {

    private static final String INSTRUCTIONS = """
        Create one evidence-grounded reading discussion guide in the required response language.
        Do not invent book facts or reader experiences. Use sourceAlias exactly as supplied.
        Keep each question open-ended and non-leading. EXPERIENCE must be answerable without
        personal disclosure. Return exactly one required item for each required stage and
        zero to three optional items. Treat private answer evidence as generation context only:
        never quote or reconstruct a reader answer in goal, issues, questions, intent, or follow-ups.
        Fit the item plan to the requested target minutes.
        """;

    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper;
    private final OpenAiResponsesTransport responsesTransport;

    public OpenAiDiscussionGuideClient(
        OpenAiProperties properties,
        ObjectMapper objectMapper,
        OpenAiResponsesTransport responsesTransport
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.responsesTransport = responsesTransport;
    }

    public Response generate(Request request, Supplier<Response> placeholder) {
        if (!configured()) {
            return placeholder.get();
        }
        long startedAt = System.nanoTime();
        GeneratedText generated = null;
        try {
            generated = createStructuredTextResult(
                properties.getModel(),
                request.generationLocale().languageInstruction() + " " + INSTRUCTIONS,
                discussionGuideInput(request),
                discussionGuideTextFormat()
            );
            if (!"completed".equals(generated.status())) {
                throw new GuideResponseStatusFailure(
                    generated.status(),
                    generated.incompleteReason()
                );
            }
            JsonNode root = objectMapper.readTree(generated.text());
            List<String> issues = jsonStrings(root.path("issues"));
            List<Item> items = new ArrayList<>();
            for (JsonNode item : root.path("items")) {
                items.add(new Item(
                    item.path("stage").asText(),
                    item.path("priority").asText(),
                    item.path("question").asText(),
                    item.path("intent").asText(),
                    item.path("sourceAlias").asText(),
                    item.path("sensitivity").asText(),
                    item.path("skippable").asBoolean(),
                    item.path("expectedMinutes").asInt(),
                    jsonStrings(item.path("followUps"))
                ));
            }
            return new Response(
                root.path("goal").asText(),
                issues,
                items,
                "openai",
                properties.getModel(),
                generated.tokenUsage(),
                elapsedMillis(startedAt),
                "SUCCESS",
                false
            );
        } catch (IOException exception) {
            throw guideFailure("MALFORMED_OUTPUT", generated, exception);
        } catch (RuntimeException exception) {
            throw guideFailure(providerFailureCategory(exception), generated, exception);
        }
    }

    public AiGenerationResult<Response> generateWithMetadata(
        Request request,
        Supplier<Response> placeholder
    ) {
        long startedAt = System.nanoTime();
        AiGenerationTask task = new AiGenerationTask(
            "DISCUSSION_GUIDE",
            request.promptVersion(),
            request.schemaVersion(),
            request.generationLocale()
        );
        try {
            Response response = generate(request, placeholder);
            return AiGenerationResult.completed(
                response,
                task,
                configured() ? "openai" : response.provider(),
                configured() ? properties.getModel() : response.model(),
                AiTokenUsage.fromJson(response.tokenUsage()),
                Math.max(response.latencyMs(), elapsedMillis(startedAt)),
                response.outcome(),
                response.fallbackUsed()
            );
        } catch (GuideProviderFailure exception) {
            return AiGenerationResult.failure(
                task,
                configured() ? "openai" : "placeholder",
                configured() ? properties.getModel() : "placeholder",
                exception.usage(),
                elapsedMillis(startedAt),
                exception.category()
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(
                task,
                configured() ? "openai" : "placeholder",
                configured() ? properties.getModel() : "placeholder",
                AiTokenUsage.NONE,
                elapsedMillis(startedAt),
                "UNCLASSIFIED"
            );
        }
    }

    private GuideProviderFailure guideFailure(
        String category,
        GeneratedText generated,
        Throwable cause
    ) {
        log.warn(
            "OpenAI Discussion Guide generation failed closed. requestId={}, category={}, error={}",
            RequestCorrelationContext.current().orElse("none"),
            category,
            cause.getClass().getSimpleName()
        );
        return new GuideProviderFailure(
            category,
            generated == null
                ? AiTokenUsage.NONE
                : AiTokenUsage.fromJson(generated.tokenUsage()),
            cause
        );
    }

    private String providerFailureCategory(RuntimeException exception) {
        if (exception instanceof GuideResponseStatusFailure) {
            return "MALFORMED_OUTPUT";
        }
        if (exception instanceof OpenAiResponsesException transport) {
            return transport.isTimeout() ? "TIMEOUT" : "TRANSPORT";
        }
        String message = exception.getMessage();
        if (message != null && message.toLowerCase(Locale.ROOT).contains("refused")) {
            return "REFUSAL";
        }
        return "TRANSPORT";
    }

    private GeneratedText createStructuredTextResult(
        String model,
        String instructions,
        String input,
        ObjectNode textFormat
    ) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);
        root.put(
            "max_output_tokens",
            properties.getDiscussionGuideMaxOutputTokens()
        );
        root.put("store", false);
        ArrayNode messages = root.putArray("input");
        messages.add(message("developer", instructions));
        messages.add(message("user", input));
        root.set("text", textFormat);

        var response = responsesTransport.execute(root);
        return new GeneratedText(
            response.status(),
            response.incompleteReason(),
            response.outputText(),
            tokenUsage(response.tokenUsage())
        );
    }

    private String discussionGuideInput(Request request) {
        StringBuilder input = new StringBuilder();
        input.append("Prompt version: ").append(safe(request.promptVersion())).append('\n');
        input.append("Schema version: ").append(safe(request.schemaVersion())).append('\n');
        input.append("Purpose: ").append(safe(request.purpose())).append('\n');
        input.append("Audience mode: ").append(safe(request.audienceMode())).append('\n');
        input.append("Target minutes: ").append(request.targetMinutes()).append('\n');
        input.append("Disclosure mode: ").append(safe(request.disclosureMode())).append('\n');
        input.append("Facilitation level: ").append(safe(request.facilitationLevel())).append('\n');
        for (Evidence evidence : request.evidence()) {
            input.append(evidence.alias())
                .append(" [")
                .append(evidence.type())
                .append("]: ")
                .append(truncate(evidence.excerpt(), 800))
                .append('\n');
        }
        return input.toString();
    }

    private ObjectNode discussionGuideTextFormat() {
        ObjectNode text = objectMapper.createObjectNode();
        ObjectNode format = text.putObject("format");
        format.put("type", "json_schema");
        format.put("name", "discussion_guide");
        format.put("strict", true);
        ObjectNode schema = format.putObject("schema");
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        ArrayNode required = schema.putArray("required");
        required.add("goal");
        required.add("issues");
        required.add("items");
        ObjectNode properties = schema.putObject("properties");
        properties.putObject("goal").put("type", "string");
        ObjectNode issues = properties.putObject("issues");
        issues.put("type", "array");
        issues.put("minItems", 2);
        issues.put("maxItems", 4);
        issues.putObject("items").put("type", "string");
        ObjectNode items = properties.putObject("items");
        items.put("type", "array");
        items.put("minItems", 5);
        items.put("maxItems", 8);
        ObjectNode item = items.putObject("items");
        item.put("type", "object");
        item.put("additionalProperties", false);
        ArrayNode itemRequired = item.putArray("required");
        for (String field : List.of(
            "stage",
            "priority",
            "question",
            "intent",
            "sourceAlias",
            "sensitivity",
            "skippable",
            "expectedMinutes",
            "followUps"
        )) {
            itemRequired.add(field);
        }
        ObjectNode itemProperties = item.putObject("properties");
        enumString(
            itemProperties,
            "stage",
            "WARM_UP",
            "INTERPRETATION",
            "EXPERIENCE",
            "SOCIAL_VALUE",
            "CLOSING"
        );
        enumString(itemProperties, "priority", "REQUIRED", "OPTIONAL");
        itemProperties.putObject("question").put("type", "string");
        itemProperties.putObject("intent").put("type", "string");
        itemProperties.putObject("sourceAlias").put("type", "string");
        enumString(itemProperties, "sensitivity", "LOW", "MEDIUM", "HIGH");
        itemProperties.putObject("skippable").put("type", "boolean");
        ObjectNode minutes = itemProperties.putObject("expectedMinutes");
        minutes.put("type", "integer");
        minutes.put("minimum", 1);
        minutes.put("maximum", 20);
        ObjectNode followUps = itemProperties.putObject("followUps");
        followUps.put("type", "array");
        followUps.put("maxItems", 2);
        followUps.putObject("items").put("type", "string");
        return text;
    }

    private void enumString(
        ObjectNode properties,
        String field,
        String... values
    ) {
        ObjectNode node = properties.putObject(field);
        node.put("type", "string");
        ArrayNode enums = node.putArray("enum");
        for (String value : values) {
            enums.add(value);
        }
    }

    private List<String> jsonStrings(JsonNode values) {
        List<String> result = new ArrayList<>();
        if (values.isArray()) {
            for (JsonNode value : values) {
                result.add(value.asText());
            }
        }
        return result;
    }

    private ObjectNode message(String role, String content) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("role", role);
        node.put("content", content);
        return node;
    }

    private String tokenUsage(AiTokenUsage usage) {
        if (AiTokenUsage.NONE.equals(usage)) {
            return null;
        }
        return usage.toJson(objectMapper);
    }

    private boolean configured() {
        return properties.getApiKey() != null && !properties.getApiKey().isBlank();
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            (System.nanoTime() - startedAt) / 1_000_000L
        );
    }

    private String truncate(String value, int maxLength) {
        String safeValue = safe(value).replaceAll("\\s+", " ").trim();
        if (safeValue.length() <= maxLength) {
            return safeValue;
        }
        return safeValue.substring(0, maxLength - 3) + "...";
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private record GeneratedText(
        String status,
        String incompleteReason,
        String text,
        String tokenUsage
    ) {
    }

    private static final class GuideResponseStatusFailure extends IllegalStateException {
        private GuideResponseStatusFailure(String status, String incompleteReason) {
            super(
                "Discussion Guide response was not completed. status="
                    + safeMetadata(status)
                    + ", reason="
                    + safeMetadata(incompleteReason)
            );
        }

        private static String safeMetadata(String value) {
            return value == null || value.isBlank() ? "missing" : value;
        }
    }

    private static final class GuideProviderFailure extends IllegalStateException {
        private final String category;
        private final AiTokenUsage usage;

        private GuideProviderFailure(
            String category,
            AiTokenUsage usage,
            Throwable cause
        ) {
            super("Discussion Guide provider generation failed", cause);
            this.category = category;
            this.usage = usage;
        }

        private String category() {
            return category;
        }

        private AiTokenUsage usage() {
            return usage;
        }
    }
}
