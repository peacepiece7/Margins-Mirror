package com.margins.quality;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiProvider;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.quality.DiscussionGuideQualityEvaluator.Corpus;
import com.margins.quality.DiscussionGuideQualityEvaluator.Fixture;
import com.margins.quality.DiscussionGuideQualityEvaluator.Review;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class DiscussionGuideQualityEvaluationTest {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final DiscussionGuideQualityEvaluator EVALUATOR =
        new DiscussionGuideQualityEvaluator(OBJECT_MAPPER);
    private static Corpus corpus;

    @BeforeAll
    static void loadCorpus() throws IOException {
        corpus = readResource(
            "/reflection-guide-quality/discussion-guide-quality-corpus-v1.json",
            Corpus.class
        );
    }

    @Test
    void validatesEverySyntheticGoldenResultThroughTheRuntimeGenerator() {
        for (Fixture fixture : corpus.fixtures()) {
            AiProvider provider = mock(AiProvider.class);
            when(provider.generateDiscussionGuide(any()))
                .thenReturn(EVALUATOR.response(fixture));
            DiscussionGuideGenerator generator = new DiscussionGuideGenerator(
                provider,
                OBJECT_MAPPER
            );

            var draft = generator.generate(
                900L,
                fixture.result().promptVersion(),
                EVALUATOR.sources(fixture)
            );

            assertThat(draft.items())
                .as(fixture.fixtureId())
                .hasSizeBetween(5, 8);
            ArgumentCaptor<Request> request = ArgumentCaptor.forClass(Request.class);
            verify(provider).generateDiscussionGuide(request.capture());
            assertThat(request.getValue().promptVersion())
                .isEqualTo(fixture.result().promptVersion());
            assertThat(request.getValue().schemaVersion())
                .isEqualTo(fixture.result().schemaVersion());
        }
    }

    @Test
    void reproducesTheMetadataOnlyBaselineScorecard() throws IOException {
        var first = EVALUATOR.evaluate(corpus, Map.of());
        var second = EVALUATOR.evaluate(corpus, Map.of());
        JsonNode expected = readResource(
            "/reflection-guide-quality/discussion-guide-quality-scorecard-v1.json",
            JsonNode.class
        );

        JsonNode firstJson = OBJECT_MAPPER.readTree(
            OBJECT_MAPPER.writeValueAsBytes(first)
        );
        JsonNode secondJson = OBJECT_MAPPER.readTree(
            OBJECT_MAPPER.writeValueAsBytes(second)
        );
        assertThat(firstJson)
            .isEqualTo(secondJson)
            .isEqualTo(expected);

        String serialized = OBJECT_MAPPER.writeValueAsString(first);
        assertThat(serialized)
            .doesNotContain("bookTitle")
            .doesNotContain("sources")
            .doesNotContain("excerpt")
            .doesNotContain("question")
            .doesNotContain("intent")
            .doesNotContain("reviews")
            .doesNotContain("독자는");
        corpus.fixtures().forEach(fixture -> {
            assertThat(serialized).doesNotContain(fixture.input().bookTitle());
            fixture.input().sources().forEach(
                source -> assertThat(serialized).doesNotContain(source.excerpt())
            );
        });
    }

    @Test
    void groupsPromptSchemaAndModelVersionsForComparison() {
        List<Fixture> comparisonFixtures = new ArrayList<>(corpus.fixtures());
        comparisonFixtures.addAll(corpus.fixtures().stream()
            .map(fixture -> new Fixture(
                fixture.fixtureId() + "-candidate",
                true,
                fixture.axes(),
                fixture.input(),
                fixture.result().withVersions(
                    "discussion-guide-v2-candidate",
                    "discussion-guide-schema-v2-candidate",
                    "fixture-model-v2"
                ),
                fixture.reviews()
            ))
            .toList());

        var scorecard = EVALUATOR.evaluate(
            new Corpus("comparison-test", comparisonFixtures),
            Map.of()
        );

        assertThat(scorecard.comparisons()).hasSize(2);
        assertThat(scorecard.comparisons())
            .extracting(DiscussionGuideQualityEvaluator.VersionComparison::fixtureCount)
            .containsExactly(12, 12);
    }

    @Test
    void rejectsNonSyntheticUncalibratedOrUnsafeEvaluationInput() {
        Fixture first = corpus.fixtures().get(0);
        List<Fixture> nonSynthetic = new ArrayList<>(corpus.fixtures());
        nonSynthetic.set(0, new Fixture(
            first.fixtureId(),
            false,
            first.axes(),
            first.input(),
            first.result(),
            first.reviews()
        ));
        assertThatThrownBy(() -> EVALUATOR.evaluate(
            new Corpus(corpus.corpusVersion(), nonSynthetic),
            Map.of()
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("synthetic");

        Map<String, Integer> uncalibratedScores = new LinkedHashMap<>(
            first.reviews().get(1).scores()
        );
        uncalibratedScores.put("groundedness", 0);
        List<Fixture> uncalibrated = new ArrayList<>(corpus.fixtures());
        uncalibrated.set(0, new Fixture(
            first.fixtureId(),
            true,
            first.axes(),
            first.input(),
            first.result(),
            List.of(
                first.reviews().get(0),
                new Review("reviewer-c", uncalibratedScores)
            )
        ));
        assertThatThrownBy(() -> EVALUATOR.evaluate(
            new Corpus(corpus.corpusVersion(), uncalibrated),
            Map.of()
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("calibration");

        assertThatThrownBy(() -> EVALUATOR.evaluate(
            corpus,
            Map.of(first.fixtureId(), List.of("raw source excerpt"))
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("metadata-only codes");
    }

    private static <T> T readResource(String path, Class<T> type) throws IOException {
        try (InputStream input = DiscussionGuideQualityEvaluationTest.class
            .getResourceAsStream(path)) {
            if (input == null) {
                throw new IllegalStateException("Missing test resource: " + path);
            }
            return OBJECT_MAPPER.readValue(input, type);
        }
    }
}
