package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.book.mapper.BookKnowledgeMapper;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.book.model.BookKnowledgeStatus;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class BookKnowledgeIntegrationTest extends AbstractMySqlIntegrationTest {
    private static final String LOOKUP_KEY = "9780000000039";

    @Autowired BookKnowledgeMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc.update(
            "DELETE FROM book_knowledge WHERE lookup_key=?",
            LOOKUP_KEY
        );
    }

    @AfterEach
    void tearDown() {
        jdbc.update(
            "DELETE FROM book_knowledge WHERE lookup_key=?",
            LOOKUP_KEY
        );
    }

    @Test
    void oneActiveClaimCompletesAndClearsLeaseMetadata() {
        BookKnowledgeRecord record = record("book-knowledge-v1", "failed");
        mapper.insert(record);

        int firstClaim = mapper.claimGeneration(
            record.getId(),
            "claim-a",
            120
        );
        int duplicateClaim = mapper.claimGeneration(
            record.getId(),
            "claim-b",
            120
        );

        assertThat(firstClaim).isEqualTo(1);
        assertThat(duplicateClaim).isZero();

        BookKnowledgeRecord completed = record("book-knowledge-v1", BookKnowledgeStatus.READY);
        completed.setId(record.getId());
        completed.setGenerationClaimToken("claim-a");
        completed.setSummary("provider-backed summary");
        completed.setGeneratedAt(LocalDateTime.now());
        assertThat(mapper.completeGeneration(completed)).isEqualTo(1);

        BookKnowledgeRecord stored = mapper.findByIdentityAndPromptVersion(
            "isbn",
            LOOKUP_KEY,
            "book-knowledge-v1"
        );
        assertThat(stored.getStatus()).isEqualTo(BookKnowledgeStatus.READY);
        assertThat(stored.getSummary()).isEqualTo("provider-backed summary");
        assertThat(stored.getGenerationClaimToken()).isNull();
        assertThat(stored.getGenerationClaimedAt()).isNull();
        assertThat(stored.isFallbackUsed()).isFalse();
    }

    @Test
    void latestReadyFallbackAndAdditiveColumnsRemainQueryable() {
        BookKnowledgeRecord previous = record("book-knowledge-v0", BookKnowledgeStatus.READY);
        previous.setGeneratedAt(LocalDateTime.now().minusDays(4));
        mapper.insert(previous);
        BookKnowledgeRecord current = record("book-knowledge-v1", "failed");
        mapper.insert(current);

        BookKnowledgeRecord fallback = mapper.findReusableReadyByIdentity(
            "isbn",
            LOOKUP_KEY,
            "book-knowledge-v1",
            365
        );
        Map<String, Object> columns = jdbc.queryForMap("""
            SELECT
              COUNT(CASE WHEN COLUMN_NAME='fallback_used' THEN 1 END) AS fallback_column,
              COUNT(CASE WHEN COLUMN_NAME='generation_claim_token' THEN 1 END) AS claim_column,
              COUNT(CASE WHEN COLUMN_NAME='generation_claimed_at' THEN 1 END) AS claimed_at_column
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE()
              AND TABLE_NAME='book_knowledge'
            """);

        assertThat(fallback.getId()).isEqualTo(previous.getId());
        assertThat(((Number) columns.get("fallback_column")).intValue()).isEqualTo(1);
        assertThat(((Number) columns.get("claim_column")).intValue()).isEqualTo(1);
        assertThat(((Number) columns.get("claimed_at_column")).intValue()).isEqualTo(1);
    }

    private BookKnowledgeRecord record(String promptVersion, String status) {
        return BookKnowledgeRecord.builder()
            .isbn(LOOKUP_KEY)
            .titleNormalized("bounded evidence integration")
            .authorNormalized("margins")
            .lookupKeyType("isbn")
            .lookupKey(LOOKUP_KEY)
            .title("Bounded Evidence Integration")
            .author("Margins")
            .summary("summary")
            .themesJson("[]")
            .discussionPointsJson(
                "[{\"id\":\"point-1\",\"question\":\"question\",\"rationale\":\"rationale\","
                    + "\"recommendedPersonaKeys\":[]}]"
            )
            .recommendedPersonasJson("[]")
            .famousQuotesJson("[]")
            .keywordsJson("[]")
            .promptVersion(promptVersion)
            .status(status)
            .fallbackUsed(false)
            .testData(true)
            .build();
    }
}
