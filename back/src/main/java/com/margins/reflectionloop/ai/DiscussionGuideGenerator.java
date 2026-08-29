package com.margins.reflectionloop.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import com.margins.ai.DiscussionGuideGeneration.Evidence;
import com.margins.ai.DiscussionGuideGeneration.Item;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.DiscussionGuideGeneration.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DiscussionGuideGenerator {
    private static final String SCHEMA_VERSION = "discussion-guide-schema-v1";
    private static final List<String> REQUIRED_STAGE_ORDER = List.of(
        "WARM_UP",
        "INTERPRETATION",
        "EXPERIENCE",
        "SOCIAL_VALUE",
        "CLOSING"
    );
    private static final Set<String> STAGES = Set.of(
        "WARM_UP",
        "INTERPRETATION",
        "EXPERIENCE",
        "SOCIAL_VALUE",
        "CLOSING"
    );
    private static final Set<String> PRIORITIES = Set.of("REQUIRED", "OPTIONAL");
    private static final Set<String> SENSITIVITIES = Set.of("LOW", "MEDIUM", "HIGH");
    private static final Set<String> PURPOSES = Set.of(
        "THOUGHT_EXPANSION",
        "ISSUE_EXPLORATION",
        "DISCUSSION_PREP"
    );
    private static final Set<String> AUDIENCE_MODES = Set.of("SELF_AI", "SMALL_GROUP");
    private static final Set<Integer> TARGET_MINUTES = Set.of(20, 40, 60);
    private static final Set<String> DISCLOSURE_MODES = Set.of(
        "PRIVATE_CONTEXT",
        "REFLECTION_ONLY"
    );
    private static final Set<String> FACILITATION_LEVELS = Set.of(
        "BEGINNER",
        "EXPERIENCED",
        "EXPERT"
    );
    private static final Map<String, String> SOURCE_ALIAS_PATTERNS = Map.of(
        "REFLECTION", "R1",
        "ANSWER", "A[1-9][0-9]*",
        "HIGHLIGHT", "H[1-9][0-9]*",
        "BOOK_KNOWLEDGE", "BK[1-9][0-9]*"
    );

    private final AiProvider aiProvider;
    private final ObjectMapper objectMapper;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;
    private AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    public GuideDraft generate(
        Long windowId,
        String promptVersion,
        List<SourceDraft> sources,
        GenerationLocale locale
    ) {
        return generate(
            windowId, promptVersion, sources, GuideBrief.defaults(), null, false, locale
        );
    }

    public GuideDraft generate(
        Long windowId,
        String promptVersion,
        List<SourceDraft> sources,
        GuideBrief brief,
        String depth,
        boolean testData,
        GenerationLocale locale
    ) {
        AiGenerationTask task = new AiGenerationTask(
            "DISCUSSION_GUIDE",
            promptVersion,
            SCHEMA_VERSION,
            locale
        );
        if (sources == null || sources.isEmpty()) {
            observePreflightFailure(task, "EVIDENCE_VALIDATION", depth, testData);
            throw new IllegalStateException("Discussion Guide requires evidence");
        }
        try {
            validateBrief(brief);
        } catch (RuntimeException exception) {
            observePreflightFailure(task, "SCHEMA_VALIDATION", depth, testData);
            throw exception;
        }
        Map<String, SourceDraft> evidence;
        try {
            evidence = evidenceByAlias(sources);
        } catch (RuntimeException exception) {
            observePreflightFailure(task, "EVIDENCE_VALIDATION", depth, testData);
            throw exception;
        }
        Request request = new Request(
            windowId,
            promptVersion,
            SCHEMA_VERSION,
            brief.purpose(),
            brief.audienceMode(),
            brief.targetMinutes(),
            brief.disclosureMode(),
            brief.facilitationLevel(),
            sources.stream()
                .map(source -> new Evidence(
                    source.alias(),
                    source.type(),
                    source.refId(),
                    source.excerpt()
                ))
                .toList(),
            locale
        );
        AiGenerationResult<Response> generation = metadataGeneration(request);
        if (generation == null) {
            generation = legacyGeneration(request, depth, testData);
        }
        try {
            GuideDraft draft = validate(
                generation,
                evidence,
                promptVersion,
                brief.targetMinutes(),
                locale
            );
            if (draft.languageValidationOutcome() != null) {
                generation = generation.withLanguageValidation(
                    AiLanguageValidationOutcome.valueOf(draft.languageValidationOutcome())
                );
            }
            generationObserver.observe(generation, depth, testData);
            return draft;
        } catch (RuntimeException exception) {
            String category = generation != null
                && "FAILURE".equalsIgnoreCase(generation.outcome())
                ? generation.failureCategory()
                : validationFailureCategory(exception);
            AiGenerationResult<Response> failure = generation == null
                    ? AiGenerationResult.failure(
                        task,
                        "unknown",
                        "unknown",
                        AiTokenUsage.NONE,
                        0,
                        category
                    )
                    : generation.withOutcome("FAILURE", false).withFailureCategory(category);
            if (exception.getMessage() != null
                && exception.getMessage().contains("language mismatch")) {
                failure = failure.withLanguageValidation(AiLanguageValidationOutcome.KNOWN_MISMATCH);
            }
            generationObserver.observe(failure, depth, testData);
            throw exception;
        }
    }

    private void observePreflightFailure(
        AiGenerationTask task,
        String category,
        String depth,
        boolean testData
    ) {
        generationObserver.observe(
            AiGenerationResult.failure(
                task,
                "none",
                "none",
                AiTokenUsage.NONE,
                0,
                category
            ),
            depth,
            testData
        );
    }

    private String validationFailureCategory(RuntimeException exception) {
        String message = exception.getMessage();
        if (message != null && message.toLowerCase(Locale.ROOT).contains("source alias")) {
            return "EVIDENCE_VALIDATION";
        }
        return "SCHEMA_VALIDATION";
    }

    private void validateBrief(GuideBrief brief) {
        if (brief == null
            || brief.purpose() == null
            || brief.audienceMode() == null
            || brief.disclosureMode() == null
            || brief.facilitationLevel() == null
            || !PURPOSES.contains(brief.purpose())
            || !AUDIENCE_MODES.contains(brief.audienceMode())
            || !TARGET_MINUTES.contains(brief.targetMinutes())
            || !DISCLOSURE_MODES.contains(brief.disclosureMode())
            || !FACILITATION_LEVELS.contains(brief.facilitationLevel())) {
            throw new IllegalStateException("Discussion Guide brief is invalid");
        }
    }

    private GuideDraft validate(
        AiGenerationResult<Response> generation,
        Map<String, SourceDraft> evidence,
        String promptVersion,
        int targetMinutes,
        GenerationLocale locale
    ) {
        Response response = generation == null ? null : generation.value();
        if (response == null) {
            throw new IllegalStateException("Discussion Guide provider returned no result");
        }
        String goal = boundedRequired(response.goal(), "goal", 500);
        List<String> issues = response.issues() == null
            ? List.of()
            : response.issues().stream()
                .map(issue -> boundedRequired(issue, "issue", 500))
                .toList();
        if (issues.size() < 2 || issues.size() > 4) {
            throw new IllegalStateException("Discussion Guide requires two to four issues");
        }
        List<Item> providerItems = response.items() == null ? List.of() : response.items();
        if (providerItems.size() < 5 || providerItems.size() > 8) {
            throw new IllegalStateException("Discussion Guide requires five to eight items");
        }
        List<String> languageUnits = new ArrayList<>();
        languageUnits.add(goal);
        languageUnits.add(String.join(" ", issues));
        providerItems.forEach(item -> languageUnits.add(
            String.join(" ", java.util.stream.Stream.concat(
                java.util.stream.Stream.of(item.question(), item.intent()),
                item.followUps() == null ? java.util.stream.Stream.empty() : item.followUps().stream()
            ).filter(java.util.Objects::nonNull).toList())
        ));
        AiLanguageValidationOutcome languageOutcome = generation.fallbackUsed()
            && generation.languageValidationOutcome() == null
                ? null
                : languageValidator.validateUnits(locale, languageUnits);
        if (languageOutcome == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
            throw new IllegalStateException("Discussion Guide language mismatch");
        }

        Map<String, Integer> requiredStages = new HashMap<>();
        List<String> requiredStageOrder = new ArrayList<>();
        Set<String> normalizedQuestions = new HashSet<>();
        List<GuideItemDraft> items = providerItems.stream().map(item -> {
            if (!STAGES.contains(item.stage())) {
                throw new IllegalStateException("Discussion Guide stage is invalid");
            }
            if (!PRIORITIES.contains(item.priority())) {
                throw new IllegalStateException("Discussion Guide priority is invalid");
            }
            if (!SENSITIVITIES.contains(item.sensitivity())) {
                throw new IllegalStateException("Discussion Guide sensitivity is invalid");
            }
            SourceDraft source = evidence.get(item.sourceAlias());
            if (source == null) {
                throw new IllegalStateException("Discussion Guide source alias is invalid");
            }
            String question = boundedRequired(item.question(), "question", 1000);
            String intent = boundedRequired(item.intent(), "intent", 1000);
            String normalized = question.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
            if (!normalizedQuestions.add(normalized)) {
                throw new IllegalStateException("Discussion Guide questions must be distinct");
            }
            List<String> followUps = item.followUps() == null
                ? List.of()
                : item.followUps().stream()
                    .map(value -> boundedRequired(value, "follow-up", 1000))
                    .toList();
            if (followUps.size() > 2) {
                throw new IllegalStateException("Discussion Guide follow-ups exceed the limit");
            }
            if (item.expectedMinutes() < 1 || item.expectedMinutes() > 20) {
                throw new IllegalStateException("Discussion Guide expected minutes are invalid");
            }
            if ("REQUIRED".equals(item.priority())) {
                requiredStages.merge(item.stage(), 1, Integer::sum);
                requiredStageOrder.add(item.stage());
            }
            boolean skippable = item.skippable() || "EXPERIENCE".equals(item.stage());
            return new GuideItemDraft(
                item.stage(),
                item.priority(),
                question,
                intent,
                source,
                item.sensitivity(),
                skippable,
                item.expectedMinutes(),
                followUps
            );
        }).toList();
        int optionalCount = (int) items.stream()
            .filter(item -> "OPTIONAL".equals(item.priority()))
            .count();
        if (optionalCount > 3) {
            throw new IllegalStateException("Discussion Guide optional item limit exceeded");
        }
        for (String stage : STAGES) {
            if (requiredStages.getOrDefault(stage, 0) != 1) {
                throw new IllegalStateException("Discussion Guide requires one required item per stage");
            }
        }
        if (!REQUIRED_STAGE_ORDER.equals(requiredStageOrder)) {
            throw new IllegalStateException("Discussion Guide required stages are out of order");
        }
        return new GuideDraft(
            goal,
            issues,
            normalizeExpectedMinutes(items, targetMinutes),
            generation.provider(),
            generation.model(),
            generation.tokenUsage().toJson(objectMapper),
            metadataJson(generation.withLanguageValidation(languageOutcome), promptVersion),
            locale.value(),
            languageOutcome == null ? null : languageOutcome.name()
        );
    }

    private List<GuideItemDraft> normalizeExpectedMinutes(
        List<GuideItemDraft> items,
        int targetMinutes
    ) {
        int weightTotal = items.stream().mapToInt(GuideItemDraft::expectedMinutes).sum();
        int[] minutes = new int[items.size()];
        double[] ideals = new double[items.size()];
        int allocated = 0;
        for (int index = 0; index < items.size(); index++) {
            ideals[index] = (double) targetMinutes * items.get(index).expectedMinutes() / weightTotal;
            minutes[index] = Math.max(1, Math.min(20, (int) Math.floor(ideals[index])));
            allocated += minutes[index];
        }
        while (allocated < targetMinutes) {
            int candidate = -1;
            double largestGap = Double.NEGATIVE_INFINITY;
            for (int index = 0; index < minutes.length; index++) {
                double gap = ideals[index] - minutes[index];
                if (minutes[index] < 20 && gap > largestGap) {
                    candidate = index;
                    largestGap = gap;
                }
            }
            if (candidate < 0) {
                throw new IllegalStateException("Discussion Guide target minutes cannot be allocated");
            }
            minutes[candidate]++;
            allocated++;
        }
        while (allocated > targetMinutes) {
            int candidate = -1;
            double largestExcess = Double.NEGATIVE_INFINITY;
            for (int index = 0; index < minutes.length; index++) {
                double excess = minutes[index] - ideals[index];
                if (minutes[index] > 1 && excess > largestExcess) {
                    candidate = index;
                    largestExcess = excess;
                }
            }
            if (candidate < 0) {
                throw new IllegalStateException("Discussion Guide target minutes cannot be allocated");
            }
            minutes[candidate]--;
            allocated--;
        }
        List<GuideItemDraft> normalized = new ArrayList<>(items.size());
        for (int index = 0; index < items.size(); index++) {
            GuideItemDraft item = items.get(index);
            normalized.add(new GuideItemDraft(
                item.stage(),
                item.priority(),
                item.question(),
                item.intent(),
                item.source(),
                item.sensitivity(),
                item.skippable(),
                minutes[index],
                item.followUps()
            ));
        }
        return List.copyOf(normalized);
    }

    private Map<String, SourceDraft> evidenceByAlias(List<SourceDraft> sources) {
        Map<String, SourceDraft> evidence = new HashMap<>();
        for (SourceDraft source : sources) {
            if (source == null || source.alias() == null
                || evidence.putIfAbsent(source.alias(), source) != null) {
                throw new IllegalStateException("Discussion Guide evidence aliases must be unique");
            }
            String aliasPattern = SOURCE_ALIAS_PATTERNS.get(source.type());
            if (aliasPattern == null || !source.alias().matches(aliasPattern)) {
                throw new IllegalStateException("Discussion Guide evidence type or alias is invalid");
            }
            if (source.refId() == null || source.refId() <= 0) {
                throw new IllegalStateException("Discussion Guide evidence reference is invalid");
            }
            boundedRequired(source.excerpt(), "evidence excerpt", 500);
        }
        return evidence;
    }

    private String metadataJson(
        AiGenerationResult<Response> generation,
        String promptVersion
    ) {
        try {
            Map<String, Object> metadata = new java.util.LinkedHashMap<>();
            metadata.put("taskType", "DISCUSSION_GUIDE");
            metadata.put("provider", generation.provider());
            metadata.put("model", generation.model());
            metadata.put("promptVersion", promptVersion);
            metadata.put("schemaVersion", SCHEMA_VERSION);
            metadata.put("latencyMs", generation.latencyMs());
            metadata.put("outcome", generation.outcome());
            metadata.put("fallbackUsed", generation.fallbackUsed());
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Discussion Guide metadata could not be serialized", exception);
        }
    }

    private String boundedRequired(String value, String field, int max) {
        String safe = value == null ? "" : value.trim();
        if (safe.isBlank() || safe.length() > max) {
            throw new IllegalStateException("Discussion Guide " + field + " is invalid");
        }
        return safe;
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private AiGenerationResult<Response> legacyGeneration(
        Request request,
        String depth,
        boolean testData
    ) {
        long startedAt = System.nanoTime();
        AiGenerationTask task = new AiGenerationTask(
            "DISCUSSION_GUIDE",
            request.promptVersion(),
            request.schemaVersion(),
            request.generationLocale()
        );
        try {
            Response response = aiProvider.generateDiscussionGuide(request);
            if (response == null) {
                return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
            }
            return AiGenerationResult.completed(
                response,
                task,
                blankTo(response.provider(), "unknown"),
                blankTo(response.model(), "unknown"),
                AiTokenUsage.fromJson(response.tokenUsage()),
                Math.max(response.latencyMs(), elapsedMillis(startedAt)),
                blankTo(response.outcome(), "UNKNOWN"),
                response.fallbackUsed()
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(
                task,
                "unknown",
                "unknown",
                elapsedMillis(startedAt)
            );
        }
    }

    private AiGenerationResult<Response> metadataGeneration(Request request) {
        long startedAt = System.nanoTime();
        try {
            return aiProvider.generateDiscussionGuideWithMetadata(request);
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(
                new AiGenerationTask(
                    "DISCUSSION_GUIDE",
                    request.promptVersion(),
                    request.schemaVersion(),
                    request.generationLocale()
                ),
                "unknown",
                "unknown",
                elapsedMillis(startedAt)
            );
        }
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }

    public record SourceDraft(
        String alias,
        String type,
        Long refId,
        String excerpt,
        String version,
        boolean stale,
        boolean fallback
    ) {
        public SourceDraft(String alias, String type, Long refId, String excerpt) {
            this(alias, type, refId, excerpt, null, false, false);
        }
    }

    public record GuideBrief(
        String purpose,
        String audienceMode,
        int targetMinutes,
        String disclosureMode,
        String facilitationLevel
    ) {
        public GuideBrief(
            String purpose,
            String audienceMode,
            int targetMinutes,
            String disclosureMode
        ) {
            this(purpose, audienceMode, targetMinutes, disclosureMode, "BEGINNER");
        }

        public static GuideBrief defaults() {
            return new GuideBrief(
                "THOUGHT_EXPANSION",
                "SMALL_GROUP",
                20,
                "PRIVATE_CONTEXT",
                "BEGINNER"
            );
        }
    }

    public record GuideDraft(
        String goal,
        List<String> issues,
        List<GuideItemDraft> items,
        String provider,
        String model,
        String tokenUsageJson,
        String generationMetadataJson,
        String generationLocale,
        String languageValidationOutcome
    ) {
        public GuideDraft(
            String goal, List<String> issues, List<GuideItemDraft> items,
            String provider, String model, String tokenUsageJson,
            String generationMetadataJson
        ) {
            this(goal, issues, items, provider, model, tokenUsageJson,
                generationMetadataJson, null, null);
        }
    }

    public record GuideItemDraft(
        String stage,
        String priority,
        String question,
        String intent,
        SourceDraft source,
        String sensitivity,
        boolean skippable,
        int expectedMinutes,
        List<String> followUps
    ) {
    }
}
