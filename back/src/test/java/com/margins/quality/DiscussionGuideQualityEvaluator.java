package com.margins.quality;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.DiscussionGuideGeneration.Item;
import com.margins.ai.DiscussionGuideGeneration.Response;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.SourceDraft;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

final class DiscussionGuideQualityEvaluator {
    static final List<String> DIMENSIONS = List.of(
        "groundedness",
        "openEndedness",
        "singleIssue",
        "stageFlow",
        "nonDuplication",
        "participationSafety",
        "facilitationUtility"
    );

    private static final int MINIMUM_FIXTURES = 12;
    private static final Set<String> GENRES = Set.of("FICTION", "NONFICTION");
    private static final Set<String> REFLECTION_LENGTHS = Set.of("SHORT", "LONG");
    private static final Set<Integer> ANSWER_COUNTS = Set.of(3, 5, 7);
    private static final Set<String> EXPERIENCE_MODES = Set.of("SKIP", "BOOK_ONLY");
    private static final Set<String> TITLE_LANGUAGES = Set.of("KOREAN", "ENGLISH");

    private final ObjectMapper objectMapper;

    DiscussionGuideQualityEvaluator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    Scorecard evaluate(Corpus corpus, Map<String, List<String>> hardFailures) {
        validateCorpus(corpus);
        validateHardFailures(corpus, hardFailures);
        List<FixtureScore> results = corpus.fixtures().stream()
            .sorted(Comparator.comparing(Fixture::fixtureId))
            .map(fixture -> score(fixture, hardFailures.getOrDefault(
                fixture.fixtureId(),
                List.of()
            )))
            .toList();
        return new Scorecard(
            "reflection-guide-quality-scorecard-v1",
            corpus.corpusVersion(),
            "synthetic-fixtures-only",
            results,
            comparisons(results)
        );
    }

    Response response(Fixture fixture) {
        FixtureResult result = fixture.result();
        try {
            return new Response(
                result.goal(),
                result.issues(),
                result.items(),
                result.provider(),
                result.model(),
                objectMapper.writeValueAsString(result.tokenUsage()),
                result.latencyMs(),
                result.outcome(),
                result.fallbackUsed()
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Fixture token usage could not be serialized", exception);
        }
    }

    List<SourceDraft> sources(Fixture fixture) {
        return fixture.input().sources().stream()
            .map(source -> new SourceDraft(
                source.alias(),
                source.type(),
                source.refId(),
                source.excerpt()
            ))
            .toList();
    }

    private void validateCorpus(Corpus corpus) {
        if (corpus == null || corpus.corpusVersion() == null
            || corpus.corpusVersion().isBlank() || corpus.fixtures() == null
            || corpus.fixtures().size() < MINIMUM_FIXTURES) {
            throw new IllegalStateException("Guide quality corpus requires at least 12 fixtures");
        }
        Set<String> fixtureIds = new java.util.HashSet<>();
        for (Fixture fixture : corpus.fixtures()) {
            if (fixture.fixtureId() == null || fixture.fixtureId().isBlank()
                || !fixtureIds.add(fixture.fixtureId())) {
                throw new IllegalStateException("Fixture IDs must be non-blank and unique");
            }
            if (!fixture.synthetic()) {
                throw new IllegalStateException("Guide quality fixtures must be synthetic");
            }
            validateInputShape(fixture);
            validateReviews(fixture);
        }
        requireAxis(corpus, "genre", GENRES);
        requireAxis(corpus, "reflectionLength", REFLECTION_LENGTHS);
        requireAxis(corpus, "answerCount", ANSWER_COUNTS);
        requireAxis(corpus, "experienceMode", EXPERIENCE_MODES);
        requireAxis(corpus, "highlightAvailable", Set.of(true, false));
        requireAxis(corpus, "bookKnowledgeAvailable", Set.of(true, false));
        requireAxis(corpus, "titleLanguage", TITLE_LANGUAGES);
        requireAxis(corpus, "conflict", Set.of(true, false));
    }

    private void validateInputShape(Fixture fixture) {
        FixtureAxes axes = fixture.axes();
        FixtureInput input = fixture.input();
        if (axes == null || input == null || input.bookTitle() == null
            || input.bookTitle().isBlank() || input.sources() == null) {
            throw new IllegalStateException("Fixture input is incomplete");
        }
        if (!GENRES.contains(axes.genre())
            || !REFLECTION_LENGTHS.contains(axes.reflectionLength())
            || !ANSWER_COUNTS.contains(axes.answerCount())
            || !EXPERIENCE_MODES.contains(axes.experienceMode())
            || !TITLE_LANGUAGES.contains(axes.titleLanguage())) {
            throw new IllegalStateException("Fixture axis value is invalid");
        }
        long answerSources = input.sources().stream()
            .filter(source -> "ANSWER".equals(source.type()))
            .count();
        boolean hasHighlight = input.sources().stream()
            .anyMatch(source -> "HIGHLIGHT".equals(source.type()));
        boolean hasBookKnowledge = input.sources().stream()
            .anyMatch(source -> "BOOK_KNOWLEDGE".equals(source.type()));
        if (answerSources != axes.answerCount()
            || hasHighlight != axes.highlightAvailable()
            || hasBookKnowledge != axes.bookKnowledgeAvailable()) {
            throw new IllegalStateException("Fixture axes do not match the source catalog");
        }
        FixtureResult result = fixture.result();
        if (result == null || blank(result.promptVersion())
            || blank(result.schemaVersion()) || blank(result.provider())
            || blank(result.model()) || blank(result.outcome())
            || result.tokenUsage() == null || result.latencyMs() < 0
            || result.tokenUsage().inputTokens() < 0
            || result.tokenUsage().outputTokens() < 0
            || result.tokenUsage().totalTokens() < 0) {
            throw new IllegalStateException("Fixture result metadata is incomplete");
        }
    }

    private void validateReviews(Fixture fixture) {
        if (fixture.reviews() == null || fixture.reviews().size() != 2) {
            throw new IllegalStateException("Every fixture requires two calibrated reviews");
        }
        Review first = fixture.reviews().get(0);
        Review second = fixture.reviews().get(1);
        if (first == null || second == null || blank(first.reviewerId())
            || blank(second.reviewerId()) || first.scores() == null
            || second.scores() == null
            || first.reviewerId().equals(second.reviewerId())) {
            throw new IllegalStateException("Fixture reviewers must be distinct");
        }
        if (!first.scores().keySet().equals(Set.copyOf(DIMENSIONS))
            || !second.scores().keySet().equals(Set.copyOf(DIMENSIONS))) {
            throw new IllegalStateException("Every semantic dimension requires a score");
        }
        for (String dimension : DIMENSIONS) {
            int firstScore = first.scores().get(dimension);
            int secondScore = second.scores().get(dimension);
            if (firstScore < 0 || firstScore > 2 || secondScore < 0 || secondScore > 2) {
                throw new IllegalStateException("Rubric scores must be between zero and two");
            }
            if (Math.abs(firstScore - secondScore) > 1) {
                throw new IllegalStateException("Reviewer calibration exceeds one point");
            }
        }
    }

    private void validateHardFailures(
        Corpus corpus,
        Map<String, List<String>> hardFailures
    ) {
        if (hardFailures == null) {
            throw new IllegalStateException("Hard failure results are required");
        }
        Set<String> fixtureIds = corpus.fixtures().stream()
            .map(Fixture::fixtureId)
            .collect(java.util.stream.Collectors.toSet());
        for (Map.Entry<String, List<String>> entry : hardFailures.entrySet()) {
            if (!fixtureIds.contains(entry.getKey()) || entry.getValue() == null) {
                throw new IllegalStateException("Hard failure fixture is invalid");
            }
            for (String code : entry.getValue()) {
                if (code == null || !code.matches("[A-Z][A-Z0-9_]{0,63}")) {
                    throw new IllegalStateException(
                        "Hard failures must use metadata-only codes"
                    );
                }
            }
        }
    }

    private <T> void requireAxis(Corpus corpus, String axis, Set<T> requiredValues) {
        Map<Object, Long> counts = corpus.fixtures().stream()
            .collect(java.util.stream.Collectors.groupingBy(
                fixture -> axisValue(fixture.axes(), axis),
                java.util.stream.Collectors.counting()
            ));
        for (T value : requiredValues) {
            if (counts.getOrDefault(value, 0L) < 2) {
                throw new IllegalStateException(
                    "Corpus axis " + axis + "=" + value + " requires two fixtures"
                );
            }
        }
    }

    private Object axisValue(FixtureAxes axes, String axis) {
        return switch (axis) {
            case "genre" -> axes.genre();
            case "reflectionLength" -> axes.reflectionLength();
            case "answerCount" -> axes.answerCount();
            case "experienceMode" -> axes.experienceMode();
            case "highlightAvailable" -> axes.highlightAvailable();
            case "bookKnowledgeAvailable" -> axes.bookKnowledgeAvailable();
            case "titleLanguage" -> axes.titleLanguage();
            case "conflict" -> axes.conflict();
            default -> throw new IllegalArgumentException("Unknown corpus axis: " + axis);
        };
    }

    private FixtureScore score(Fixture fixture, List<String> hardFailures) {
        Map<String, Double> dimensionScores = new LinkedHashMap<>();
        for (String dimension : DIMENSIONS) {
            double average = fixture.reviews().stream()
                .mapToInt(review -> review.scores().get(dimension))
                .average()
                .orElseThrow();
            dimensionScores.put(dimension, roundOne(average));
        }
        double overall = dimensionScores.values().stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElseThrow();
        FixtureResult result = fixture.result();
        return new FixtureScore(
            fixture.fixtureId(),
            result.promptVersion(),
            result.schemaVersion(),
            result.model(),
            result.provider(),
            result.tokenUsage(),
            result.latencyMs(),
            result.outcome(),
            List.copyOf(hardFailures),
            dimensionScores,
            roundOne(overall)
        );
    }

    private List<VersionComparison> comparisons(List<FixtureScore> results) {
        Map<VersionKey, List<FixtureScore>> grouped = new TreeMap<>(
            Comparator.comparing(VersionKey::promptVersion)
                .thenComparing(VersionKey::schemaVersion)
                .thenComparing(VersionKey::model)
        );
        for (FixtureScore result : results) {
            VersionKey key = new VersionKey(
                result.promptVersion(),
                result.schemaVersion(),
                result.model()
            );
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(result);
        }
        return grouped.entrySet().stream().map(entry -> {
            Map<String, Double> dimensionScores = new LinkedHashMap<>();
            for (String dimension : DIMENSIONS) {
                double average = entry.getValue().stream()
                    .mapToDouble(result -> result.dimensionScores().get(dimension))
                    .average()
                    .orElseThrow();
                dimensionScores.put(dimension, roundOne(average));
            }
            double overall = entry.getValue().stream()
                .mapToDouble(FixtureScore::overallScore)
                .average()
                .orElseThrow();
            long hardFailureCount = entry.getValue().stream()
                .filter(result -> !result.hardFailures().isEmpty())
                .count();
            return new VersionComparison(
                entry.getKey().promptVersion(),
                entry.getKey().schemaVersion(),
                entry.getKey().model(),
                entry.getValue().size(),
                hardFailureCount,
                dimensionScores,
                roundOne(overall)
            );
        }).toList();
    }

    private double roundOne(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    record Corpus(String corpusVersion, List<Fixture> fixtures) {
    }

    record Fixture(
        String fixtureId,
        boolean synthetic,
        FixtureAxes axes,
        FixtureInput input,
        FixtureResult result,
        List<Review> reviews
    ) {
    }

    record FixtureAxes(
        String genre,
        String reflectionLength,
        int answerCount,
        String experienceMode,
        boolean highlightAvailable,
        boolean bookKnowledgeAvailable,
        String titleLanguage,
        boolean conflict
    ) {
    }

    record FixtureInput(String bookTitle, List<FixtureSource> sources) {
    }

    record FixtureSource(String alias, String type, Long refId, String excerpt) {
    }

    record FixtureResult(
        String promptVersion,
        String schemaVersion,
        String provider,
        String model,
        TokenUsage tokenUsage,
        int latencyMs,
        String outcome,
        boolean fallbackUsed,
        String goal,
        List<String> issues,
        List<Item> items
    ) {
        FixtureResult withVersions(String promptVersion, String schemaVersion, String model) {
            return new FixtureResult(
                promptVersion,
                schemaVersion,
                provider,
                model,
                tokenUsage,
                latencyMs,
                outcome,
                fallbackUsed,
                goal,
                issues,
                items
            );
        }
    }

    record TokenUsage(long inputTokens, long outputTokens, long totalTokens) {
    }

    record Review(String reviewerId, Map<String, Integer> scores) {
    }

    record Scorecard(
        String formatVersion,
        String corpusVersion,
        String contentPolicy,
        List<FixtureScore> results,
        List<VersionComparison> comparisons
    ) {
    }

    record FixtureScore(
        String fixtureId,
        String promptVersion,
        String schemaVersion,
        String model,
        String provider,
        TokenUsage tokenUsage,
        int latencyMs,
        String outcome,
        List<String> hardFailures,
        Map<String, Double> dimensionScores,
        double overallScore
    ) {
        FixtureScore {
            hardFailures = List.copyOf(hardFailures);
            dimensionScores = Collections.unmodifiableMap(
                new LinkedHashMap<>(dimensionScores)
            );
        }
    }

    record VersionComparison(
        String promptVersion,
        String schemaVersion,
        String model,
        int fixtureCount,
        long hardFailureCount,
        Map<String, Double> dimensionScores,
        double overallScore
    ) {
        VersionComparison {
            dimensionScores = Collections.unmodifiableMap(
                new LinkedHashMap<>(dimensionScores)
            );
        }
    }

    private record VersionKey(String promptVersion, String schemaVersion, String model) {
    }
}
