package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.testsupport.ContractTextSupport;
import java.io.IOException;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class SqlSoftDeleteContractTest {

    @Test
    void bookSessionLocatorReadsOnlyActiveOwnedSessionMetadata() throws IOException {
        String mapper = ContractTextSupport.readNormalized(
            Path.of("src/main/java/com/margins/session/mapper/ReadingSessionMapper.java")
        );

        assertThat(mapper)
            .contains("SELECT rs.id, rs.title")
            .contains("INNER JOIN books b ON b.id = rs.book_id")
            .contains("WHERE rs.book_id = #{bookId} AND rs.user_id = #{userId}")
            .contains("AND rs.deleted_at IS NULL AND b.deleted_at IS NULL")
            .contains("ORDER BY rs.updated_at DESC, rs.id DESC")
            .doesNotContain("COUNT(DISTINCT")
            .doesNotContain("findSummariesByUserId");
    }

    @Test
    void metricSourceAggregatesIgnoreArchivedWindowRecords() throws IOException {
        String mapper = ContractTextSupport.readNormalized(
            Path.of("src/main/java/com/margins/metric/mapper/MetricMapper.java")
        );
        String lookupQuery = ContractTextSupport.readNormalized(Path.of("../db/queries/004_metric_sources.sql"));

        assertMetricSourceContract(mapper);
        assertMetricSourceContract(lookupQuery);
    }

    @Test
    void sessionQueriesDoNotReferenceProgressColumnsRemovedByMapperMigration() throws IOException {
        String timelineQuery = ContractTextSupport.readNormalized(Path.of("../db/queries/001_session_timeline.sql"));
        String metricQuery = ContractTextSupport.readNormalized(Path.of("../db/queries/004_metric_sources.sql"));

        assertLegacyProgressColumnsRemoved(timelineQuery);
        assertLegacyProgressColumnsRemoved(metricQuery);
    }

    @Test
    void bookMapperStoresRawMetadataWithoutSelectAliasesInInsertColumns() throws IOException {
        String mapper = ContractTextSupport.readNormalized(
            Path.of("src/main/java/com/margins/book/mapper/BookMapper.java")
        );

        assertThat(mapper)
            .contains("raw_metadata,\n          reading_status,\n          is_test_data")
            .contains("#{rawMetadata},\n          COALESCE(#{readingStatus}, 'want_to_read'),")
            .contains("raw_metadata = #{rawMetadata}")
            .doesNotContain("INSERT INTO books (\n          user_id,\n          title,\n          author,\n          isbn,\n          published_year,\n          source,\n          source_ref,\n          raw_metadata AS rawMetadata");
    }

    @Test
    void seedRefreshesBookRawMetadataOnDuplicateRows() throws IOException {
        String seed = ContractTextSupport.readNormalized(Path.of("../db/seed/001_seed_mvp_data.sql"));

        assertThat(seed)
            .contains("'aiProfile', JSON_OBJECT(")
            .contains("raw_metadata = VALUES(raw_metadata)")
            .contains("published_year = VALUES(published_year)")
            .contains("isbn = VALUES(isbn)");
    }

    @Test
    void productionSchemaBackfillsMissingOrStaleBookAiProfiles() throws IOException {
        String backfill = ContractTextSupport.readNormalized(Path.of("../db/schema/007_backfill_book_ai_profiles.sql"));
        String gapQuery = ContractTextSupport.readNormalized(Path.of("../db/queries/005_book_ai_profile_gaps.sql"));

        assertThat(backfill)
            .contains("UPDATE books")
            .contains("JSON_SET(")
            .contains("'$.aiProfile'")
            .contains("'schema-007-book-ai-profile-backfill'")
            .contains("JSON_EXTRACT(raw_metadata, '$.aiProfile') IS NULL")
            .contains("JSON_EXTRACT(raw_metadata, '$.aiProfile.title')")
            .contains("NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_metadata, '$.aiProfile.publishedYear')), 'null')");

        assertThat(gapQuery)
            .contains("profile_title")
            .contains("profile_author")
            .contains("profile_isbn")
            .contains("profile_published_year")
            .contains("JSON_EXTRACT(b.raw_metadata, '$.aiProfile') IS NULL");
    }

    @Test
    void sessionWindowAiContextKeepsSessionsForSoftDeletedBooksReadable() throws IOException {
        String mapper = ContractTextSupport.readNormalized(
            Path.of("src/main/java/com/margins/session/mapper/SessionWindowMapper.java")
        );

        assertThat(mapper)
            .contains("b.raw_metadata AS bookRawMetadata")
            .contains("AND rs.deleted_at IS NULL")
            .doesNotContain("AND b.deleted_at IS NULL");
    }

    private static void assertMetricSourceContract(String sqlText) {
        assertThat(sqlText)
            .contains("FROM session_windows qsw")
            .contains("WHERE qsw.id = q.window_id")
            .contains("AND qsw.deleted_at IS NULL")
            .contains("FROM session_windows msw")
            .contains("WHERE msw.id = m.window_id")
            .contains("AND msw.deleted_at IS NULL");
    }

    private static void assertLegacyProgressColumnsRemoved(String sqlText) {
        assertThat(sqlText)
            .doesNotContain("start_page")
            .doesNotContain("current_page")
            .doesNotContain("target_page")
            .doesNotContain("progress_note")
            .doesNotContain("pages_read_estimate");
    }
}
