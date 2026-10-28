package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationFixtureSupport;
import com.margins.testsupport.IntegrationSchemaSupport;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ReadingSessionCurrentSchemaIntegrationTest extends AbstractMySqlIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void resetSessionGraph() throws Exception {
        IntegrationFixtureSupport.resetSessionGraph(dataSource);
    }

    @Test
    void migrationBackfillsLatestCreatedSessionAndKeepsThePointerDeleteSafe() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "ALTER TABLE books DROP FOREIGN KEY fk_books_current_reading_session",
            "ALTER TABLE books DROP INDEX idx_books_current_reading_session",
            "ALTER TABLE books DROP COLUMN current_reading_session_id",
            "ALTER TABLE reading_sessions DROP INDEX idx_reading_sessions_owner_created",
            "ALTER TABLE reading_sessions DROP INDEX idx_reading_sessions_book_owner_created"
        );
        jdbc.update("""
            INSERT INTO books (user_id, title, author, source, reading_status, is_test_data)
            VALUES (1, 'Current pointer fixture', 'Reader', 'integration', 'reading', TRUE)
            """);
        Long bookId = jdbc.queryForObject(
            "SELECT id FROM books WHERE title='Current pointer fixture'",
            Long.class
        );
        jdbc.update("""
            INSERT INTO reading_sessions (user_id, book_id, title, created_at, updated_at, is_test_data)
            VALUES (1, ?, 'Older session fixture', '2025-01-01 00:00:00', CURRENT_TIMESTAMP, TRUE)
            """, bookId);
        jdbc.update("""
            INSERT INTO reading_sessions (user_id, book_id, title, created_at, updated_at, is_test_data)
            VALUES (1, ?, 'Current session fixture', '2025-02-01 00:00:00', '2025-02-01 00:00:00', TRUE)
            """, bookId);
        Long sessionId = jdbc.queryForObject(
            "SELECT id FROM reading_sessions WHERE book_id=? AND title='Current session fixture'",
            Long.class,
            bookId
        );

        IntegrationSchemaSupport.executeSql(
            dataSource,
            Files.readString(Path.of("../db/schema/059_add_current_reading_session.sql"))
        );

        assertThat(jdbc.queryForObject(
            "SELECT current_reading_session_id FROM books WHERE id=?",
            Long.class,
            bookId
        )).isEqualTo(sessionId);

        jdbc.update("DELETE FROM reading_sessions WHERE id=?", sessionId);

        assertThat(jdbc.queryForObject(
            "SELECT current_reading_session_id IS NULL FROM books WHERE id=?",
            Boolean.class,
            bookId
        )).isTrue();
        assertThat(jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'books'
              AND INDEX_NAME = 'idx_books_current_reading_session'
            """, Integer.class)).isPositive();
        assertThat(jdbc.queryForObject("""
            SELECT COLUMN_COMMENT
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'books'
              AND COLUMN_NAME = 'current_reading_session_id'
            """, String.class)).isEqualTo("현재 독서 세션 ID");
    }
}
