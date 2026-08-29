package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.book.mapper.BookKnowledgeMapper;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.book.model.BookKnowledgeStatus;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;
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
            "ko",
            120
        );
        int duplicateClaim = mapper.claimGeneration(
            record.getId(),
            "claim-b",
            "ko",
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
            "book-knowledge-v1",
            "ko"
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
            "ko",
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

    @Test
    void koAndEnRowsCoexistWhileLegacyRowsAreExcluded() {
        BookKnowledgeRecord korean = record("book-knowledge-v1", BookKnowledgeStatus.READY);
        korean.setGenerationLocale("ko");
        korean.setGeneratedAt(LocalDateTime.now());
        mapper.insert(korean);
        BookKnowledgeRecord english = record("book-knowledge-v1", BookKnowledgeStatus.READY);
        english.setGenerationLocale("en");
        english.setSummary("English summary");
        english.setGeneratedAt(LocalDateTime.now());
        mapper.insert(english);
        BookKnowledgeRecord legacy = record("book-knowledge-v0", BookKnowledgeStatus.READY);
        legacy.setGenerationLocale(null);
        legacy.setGeneratedAt(LocalDateTime.now());
        mapper.insert(legacy);

        assertThat(mapper.findByIdentityAndPromptVersion(
            "isbn", LOOKUP_KEY, "book-knowledge-v1", "ko"
        ).getId()).isEqualTo(korean.getId());
        assertThat(mapper.findByIdentityAndPromptVersion(
            "isbn", LOOKUP_KEY, "book-knowledge-v1", "en"
        ).getId()).isEqualTo(english.getId());
        assertThat(mapper.findReadyByIsbn(LOOKUP_KEY, "ko").getId())
            .isEqualTo(korean.getId());
        assertThat(mapper.findReadyByTitleAuthor(
            "bounded evidence integration", "margins", "en"
        ).getId()).isEqualTo(english.getId());
        assertThat(mapper.findReusableReadyByIdentity(
            "isbn", LOOKUP_KEY, "book-knowledge-v0", "ko", 365
        ).getId()).isEqualTo(korean.getId());
    }

    @Test
    void claimAndFinalizeRequireTheExactLocale() {
        BookKnowledgeRecord record = record("book-knowledge-v1", "failed");
        mapper.insert(record);
        assertThat(mapper.claimGeneration(record.getId(), "claim-ko", "en", 120)).isZero();
        assertThat(mapper.claimGeneration(record.getId(), "claim-ko", "ko", 120)).isEqualTo(1);

        BookKnowledgeRecord completed = record("book-knowledge-v1", BookKnowledgeStatus.READY);
        completed.setId(record.getId());
        completed.setGenerationClaimToken("claim-ko");
        completed.setGenerationLocale("en");
        completed.setGeneratedAt(LocalDateTime.now());
        assertThat(mapper.completeGeneration(completed)).isZero();
        assertThat(mapper.failGeneration(record.getId(), "claim-ko", "en", "wrong locale"))
            .isZero();

        completed.setGenerationLocale("ko");
        assertThat(mapper.completeGeneration(completed)).isEqualTo(1);
    }

    @Test
    void migration053UpgradesLegacyIdentityWithoutBackfill() throws Exception {
        String table = "upgrade_053_book_knowledge";
        try {
            jdbc.execute("DROP TABLE IF EXISTS " + table);
            jdbc.execute("""
                CREATE TABLE upgrade_053_book_knowledge (
                  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                  lookup_key_type VARCHAR(40) NOT NULL,
                  lookup_key VARCHAR(600) NOT NULL,
                  prompt_version VARCHAR(80) NOT NULL,
                  status VARCHAR(40) NOT NULL,
                  generation_claimed_at TIMESTAMP(6) NULL,
                  UNIQUE KEY uk_upgrade_053_book_knowledge_lookup_version_status (
                    lookup_key_type, lookup_key, prompt_version, status
                  ),
                  KEY idx_upgrade_053_book_knowledge_claim (
                    lookup_key_type, lookup_key, prompt_version, generation_claimed_at
                  )
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """);
            jdbc.update("""
                INSERT INTO upgrade_053_book_knowledge (
                  lookup_key_type, lookup_key, prompt_version, status
                ) VALUES ('isbn', 'legacy', 'v1', 'ready')
                """);
            String migration = Files.readString(
                Path.of("../db/schema/053_add_book_knowledge_generation_locale.sql")
            ).replace("book_knowledge", table);

            jdbc.execute(migration);

            assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table
                    + " WHERE generation_locale IS NULL AND language_validation_outcome IS NULL",
                Integer.class
            )).isEqualTo(1);
            assertThat(jdbc.queryForList("""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA=DATABASE()
                  AND TABLE_NAME='upgrade_053_book_knowledge'
                  AND INDEX_NAME='uk_upgrade_053_book_knowledge_lookup_version_locale_status'
                ORDER BY SEQ_IN_INDEX
                """, String.class)).containsExactly(
                    "lookup_key_type", "lookup_key", "prompt_version", "generation_locale", "status"
                );
            assertThatThrownBy(() -> jdbc.update(
                "UPDATE " + table + " SET generation_locale='KO' WHERE id=1"
            )).isInstanceOf(org.springframework.dao.DataAccessException.class);
        } finally {
            jdbc.execute("DROP TABLE IF EXISTS " + table);
        }
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
            .generationLocale("ko")
            .status(status)
            .fallbackUsed(false)
            .testData(true)
            .build();
    }
}
