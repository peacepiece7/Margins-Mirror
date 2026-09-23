package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.session.dto.BookReadingSessionResponse;
import com.margins.session.service.ReadingSessionService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationFixtureSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import java.sql.Statement;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ReadingSessionEnsureConcurrencyIntegrationTest extends AbstractMySqlIntegrationTest {

    @Autowired
    private ReadingSessionService readingSessionService;

    @Autowired
    private JdbcTemplate jdbc;

    private Long bookId;

    @BeforeEach
    void seedOwnedBookWithoutSession() throws Exception {
        IntegrationFixtureSupport.resetSessionGraph(dataSource);
        jdbc.update("""
            INSERT INTO books (user_id, title, author, source, reading_status, is_test_data)
            VALUES (1, 'Concurrent Debate Book', 'Fixture Author', 'integration', 'reading', TRUE)
            """);
        bookId = jdbc.queryForObject(
            "SELECT id FROM books WHERE title='Concurrent Debate Book'",
            Long.class
        );
    }

    @Test
    // BDD: SESSION-006
    void concurrentEnsureReturnsOneSessionAndCreatesNoWindow() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        BookReadingSessionResponse first;
        BookReadingSessionResponse second;

        try (var executor = Executors.newFixedThreadPool(2)) {
            var firstFuture = executor.submit(() -> {
                start.await();
                return readingSessionService.ensureForBook(bookId, 1L);
            });
            var secondFuture = executor.submit(() -> {
                start.await();
                return readingSessionService.ensureForBook(bookId, 1L);
            });
            start.countDown();
            first = firstFuture.get();
            second = secondFuture.get();
        }

        assertThat(first.getSessionId()).isEqualTo(second.getSessionId());
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM reading_sessions WHERE user_id=1 AND book_id=? AND deleted_at IS NULL",
            Integer.class,
            bookId
        )).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM session_windows WHERE session_id=? AND deleted_at IS NULL",
            Integer.class,
            first.getSessionId()
        )).isZero();
        assertThat(jdbc.queryForObject(
            "SELECT current_reading_session_id FROM books WHERE id=?",
            Long.class,
            bookId
        )).isEqualTo(first.getSessionId());
    }

    @Test
    // BDD: SESSION-009
    void archiveDoesNotOverwriteANewerCurrentSessionCreatedWhileWaitingForTheBookLock()
        throws Exception {
        jdbc.update("""
            INSERT INTO reading_sessions (user_id, book_id, title, is_test_data)
            VALUES (1, ?, 'Session to archive', TRUE)
            """, bookId);
        Long archivedSessionId = jdbc.queryForObject(
            "SELECT id FROM reading_sessions WHERE book_id=? AND title='Session to archive'",
            Long.class,
            bookId
        );
        jdbc.update(
            "UPDATE books SET current_reading_session_id=? WHERE id=?",
            archivedSessionId,
            bookId
        );

        Long newerSessionId;
        try (var lockOwner = dataSource.getConnection(); var executor = Executors.newSingleThreadExecutor()) {
            lockOwner.setAutoCommit(false);
            try (var lock = lockOwner.prepareStatement("SELECT id FROM books WHERE id=? FOR UPDATE")) {
                lock.setLong(1, bookId);
                lock.executeQuery();
            }
            CountDownLatch archiveStarted = new CountDownLatch(1);
            var archive = executor.submit(() -> {
                TestSecurityContextSupport.loginAs(1L, "archive-concurrency@example.com");
                try {
                    archiveStarted.countDown();
                    readingSessionService.archive(archivedSessionId);
                } finally {
                    TestSecurityContextSupport.clear();
                }
            });
            assertThat(archiveStarted.await(5, TimeUnit.SECONDS)).isTrue();
            Thread.sleep(300);
            assertThat(archive).isNotDone();

            try (var insert = lockOwner.createStatement()) {
                insert.executeUpdate("""
                    INSERT INTO reading_sessions (user_id, book_id, title, is_test_data)
                    VALUES (1, %d, 'Newer current session', TRUE)
                    """.formatted(bookId), Statement.RETURN_GENERATED_KEYS);
                try (var keys = insert.getGeneratedKeys()) {
                    assertThat(keys.next()).isTrue();
                    newerSessionId = keys.getLong(1);
                }
            }
            try (var point = lockOwner.prepareStatement(
                "UPDATE books SET current_reading_session_id=? WHERE id=?"
            )) {
                point.setLong(1, newerSessionId);
                point.setLong(2, bookId);
                point.executeUpdate();
            }
            lockOwner.commit();
            archive.get(5, TimeUnit.SECONDS);
        }

        assertThat(jdbc.queryForObject(
            "SELECT current_reading_session_id FROM books WHERE id=?",
            Long.class,
            bookId
        )).isEqualTo(newerSessionId);
    }
}
