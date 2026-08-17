package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.PersistentAiGenerationObserver;
import com.margins.common.support.RequestCorrelationContext;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class AiGenerationObservabilityIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired PersistentAiGenerationObserver observer;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        jdbc.update("DELETE FROM ai_generation_events");
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM ai_generation_events");
    }

    @Test
    void storesIdentifierFreeUsageAndSupportsTaskDepthPercentiles() {
        String correlationId = "11111111-1111-4111-8111-111111111111";
        RequestCorrelationContext.bind(correlationId);
        try {
            observer.observe(result(10, 4, 6, 10, false), "SIMPLE", false);
            observer.observe(result(20, 8, 7, 20, true), "SIMPLE", false);
            observer.observe(result(30, 12, 8, 90, false), "SIMPLE", false);
            observer.observe(result(999, 999, 999, 999, false), "DEEP", true);
        } finally {
            RequestCorrelationContext.clear();
        }

        Map<String, Object> aggregate = jdbc.queryForMap("""
            WITH ranked AS (
              SELECT
                input_tokens,
                cached_input_tokens,
                output_tokens,
                latency_ms,
                fallback_used,
                ROW_NUMBER() OVER (ORDER BY latency_ms, id) AS latency_rank,
                COUNT(*) OVER () AS call_count
              FROM ai_generation_events
              WHERE task_type='DISCUSSION_GUIDE'
                AND depth='SIMPLE'
                AND is_test_data=FALSE
            )
            SELECT
              MAX(call_count) AS call_count,
              SUM(input_tokens) AS input_tokens,
              SUM(cached_input_tokens) AS cached_input_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallback_count,
              MIN(CASE
                WHEN latency_rank >= CEIL(call_count * 0.50) THEN latency_ms
              END) AS latency_p50_ms,
              MIN(CASE
                WHEN latency_rank >= CEIL(call_count * 0.95) THEN latency_ms
              END) AS latency_p95_ms
            FROM ranked
            """);

        assertThat(((Number) aggregate.get("call_count")).longValue()).isEqualTo(3);
        assertThat(((Number) aggregate.get("input_tokens")).longValue()).isEqualTo(60);
        assertThat(((Number) aggregate.get("cached_input_tokens")).longValue()).isEqualTo(24);
        assertThat(((Number) aggregate.get("output_tokens")).longValue()).isEqualTo(21);
        assertThat(((Number) aggregate.get("fallback_count")).longValue()).isEqualTo(1);
        assertThat(((Number) aggregate.get("latency_p50_ms")).intValue()).isEqualTo(20);
        assertThat(((Number) aggregate.get("latency_p95_ms")).intValue()).isEqualTo(90);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE correlation_id=?",
            Integer.class,
            correlationId
        )).isEqualTo(4);

        Integer forbiddenColumns = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE()
              AND TABLE_NAME='ai_generation_events'
              AND COLUMN_NAME IN (
                'user_id', 'book_id', 'session_id', 'window_id', 'message_id',
                'question_id', 'reflection_id', 'guide_id', 'run_id',
                'prompt', 'content', 'source_excerpt', 'provider_response'
              )
            """, Integer.class);
        assertThat(forbiddenColumns).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM ai_generation_events WHERE is_test_data=TRUE",
            Integer.class
        )).isEqualTo(1);
    }

    @Test
    void operationsQueryReturnsComparableWindowsAndExplicitZeroTotals() throws Exception {
        observer.observe(result(10, 4, 6, 10, false), "SIMPLE", false);
        observer.observe(result(20, 8, 7, 20, true), "SIMPLE", false);
        observer.observe(result(30, 12, 8, 90, false), "SIMPLE", false);
        observer.observe(result(999, 999, 999, 999, false), "DEEP", true);

        String sql = Files.readString(Path.of("../db/queries/015_ai_generation_events.sql"));
        List<JsonNode> rows = jdbc.query(
            sql,
            (resultSet, rowNumber) -> readJson(resultSet.getString("snapshot_json"))
        );

        JsonNode current7 = total(rows, "CURRENT_7D");
        JsonNode previous7 = total(rows, "PREVIOUS_7D");
        JsonNode current30 = total(rows, "CURRENT_30D");
        assertThat(current7.path("callCount").asLong()).isEqualTo(3);
        assertThat(current7.path("inputTokens").asLong()).isEqualTo(60);
        assertThat(current7.path("cachedInputTokens").asLong()).isEqualTo(24);
        assertThat(current7.path("outputTokens").asLong()).isEqualTo(21);
        assertThat(current7.path("fallbackCount").asLong()).isEqualTo(1);
        assertThat(current7.path("failureCount").asLong()).isZero();
        assertThat(current7.path("outputP50Tokens").asLong()).isEqualTo(7);
        assertThat(current7.path("outputP95Tokens").asLong()).isEqualTo(8);
        assertThat(current7.path("latencyP50Ms").asLong()).isEqualTo(20);
        assertThat(current7.path("latencyP95Ms").asLong()).isEqualTo(90);
        assertThat(current7.path("actionRatioStatus").asText()).isEqualTo("NOT_OBSERVABLE");
        assertThat(current7.path("callsPerUserAction").isNull()).isTrue();
        assertThat(previous7.path("callCount").asLong()).isZero();
        assertThat(previous7.path("outputP95Tokens").isNull()).isTrue();
        assertThat(current30.path("callCount").asLong()).isEqualTo(3);
        assertThat(rows)
            .filteredOn(row ->
                row.path("scope").asText().equals("TASK_VERSION")
                    && row.path("windowLabel").asText().equals("CURRENT_7D")
            )
            .hasSize(1)
            .allSatisfy(row -> {
                assertThat(row.path("taskType").asText()).isEqualTo("DISCUSSION_GUIDE");
                assertThat(row.path("depth").asText()).isEqualTo("SIMPLE");
                assertThat(row.path("callCount").asLong()).isEqualTo(3);
                assertThat(row.path("dailyPeakTotalTokens").asLong()).isEqualTo(81);
            });
    }

    @Test
    void operationsQueryPreservesFiveDecimalRatePrecision() throws Exception {
        for (int index = 0; index < 8; index++) {
            observer.observe(result(10, 4, 6, 10, false), "SIMPLE", false);
        }
        for (int index = 0; index < 2; index++) {
            observer.observe(result(10, 4, 6, 10, true), "SIMPLE", false);
        }
        observer.observe(failure("TIMEOUT", 10), "SIMPLE", false);

        String sql = Files.readString(Path.of("../db/queries/015_ai_generation_events.sql"));
        List<JsonNode> rows = jdbc.query(
            sql,
            (resultSet, rowNumber) -> readJson(resultSet.getString("snapshot_json"))
        );

        JsonNode current7 = total(rows, "CURRENT_7D");
        assertThat(current7.path("callCount").asInt()).isEqualTo(11);
        assertThat(current7.path("successCount").asInt()).isEqualTo(8);
        assertThat(current7.path("fallbackCount").asInt()).isEqualTo(2);
        assertThat(current7.path("failureCount").asInt()).isEqualTo(1);
        assertThat(current7.path("successRate").toString()).isEqualTo("0.72727");
        assertThat(current7.path("fallbackRate").toString()).isEqualTo("0.18182");
        assertThat(current7.path("failureRate").toString()).isEqualTo("0.09091");
    }

    @Test
    void failureQueryGroupsBoundedCategoriesWithoutProductIdentifiers() throws Exception {
        observer.observe(failure("TIMEOUT", 30), "SIMPLE", false);
        observer.observe(failure("EVIDENCE_VALIDATION", 5), "SIMPLE", false);
        observer.observe(failure("UNCLASSIFIED", 10), null, false);

        String sql = Files.readString(Path.of("../db/queries/016_ai_generation_failures.sql"));
        List<JsonNode> rows = jdbc.query(
            sql,
            (resultSet, rowNumber) ->
                readJson(resultSet.getString("failure_snapshot_json"))
        );

        assertThat(rows)
            .filteredOn(row -> row.path("windowLabel").asText().equals("CURRENT_7D"))
            .extracting(row -> row.path("failureCategory").asText())
            .containsExactlyInAnyOrder(
                "TIMEOUT",
                "EVIDENCE_VALIDATION",
                "UNCLASSIFIED"
            );
        assertThat(rows)
            .allSatisfy(row -> {
                assertThat(row.path("failureCount").asInt()).isEqualTo(1);
                assertThat(row.toString())
                    .doesNotContain(
                        "userId",
                        "bookId",
                        "sessionId",
                        "reflectionId",
                        "guideId",
                        "content",
                        "sourceExcerpt",
                        "providerResponse"
                    );
            });
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO ai_generation_events (
              request_id, task_type, provider, model, prompt_version, schema_version,
              input_tokens, cached_input_tokens, output_tokens, latency_ms,
              outcome, fallback_used, failure_category, is_test_data
            ) VALUES (
              UUID(), 'DISCUSSION_GUIDE', 'openai', 'gpt-test', 'guide-v1', 'schema-v1',
              0, 0, 0, 1, 'FAILURE', FALSE, 'RAW_PROVIDER_MESSAGE', FALSE
            )
            """))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }

    private JsonNode total(List<JsonNode> rows, String windowLabel) {
        return rows.stream()
            .filter(row ->
                row.path("scope").asText().equals("WINDOW_TOTAL")
                    && row.path("windowLabel").asText().equals(windowLabel)
            )
            .findFirst()
            .orElseThrow();
    }

    private JsonNode readJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Snapshot query returned invalid JSON", exception);
        }
    }

    private AiGenerationResult<String> result(
        long inputTokens,
        long cachedInputTokens,
        long outputTokens,
        int latencyMs,
        boolean fallbackUsed
    ) {
        return AiGenerationResult.completed(
            "not persisted",
            new AiGenerationTask(
                "DISCUSSION_GUIDE",
                "discussion-guide-v1",
                "discussion-guide-schema-v1"
            ),
            "openai",
            "gpt-test",
            new AiTokenUsage(
                inputTokens,
                cachedInputTokens,
                outputTokens,
                inputTokens + outputTokens
            ),
            latencyMs,
            fallbackUsed ? "FALLBACK" : "SUCCESS",
            fallbackUsed
        );
    }

    private AiGenerationResult<String> failure(String category, int latencyMs) {
        return AiGenerationResult.failure(
            new AiGenerationTask(
                "DISCUSSION_GUIDE",
                "discussion-guide-v1",
                "discussion-guide-schema-v1"
            ),
            "openai",
            "gpt-test",
            AiTokenUsage.NONE,
            latencyMs,
            category
        );
    }
}
