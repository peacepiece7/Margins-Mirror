package com.margins.testsupport;

import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.book.model.BookReadingStatus;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.ReadingSessionRecord;
import com.margins.session.model.SessionWindowRecord;
import javax.sql.DataSource;

public final class IntegrationFixtureSupport {

    public record SessionGraph(Long userId, Long bookId, Long sessionId, Long windowId) {
    }

    private IntegrationFixtureSupport() {
    }

    public static void resetSessionGraph(DataSource dataSource) throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "SET FOREIGN_KEY_CHECKS = 0",
            "TRUNCATE TABLE refresh_tokens",
            "TRUNCATE TABLE user_oauth_identities",
            "TRUNCATE TABLE messages",
            "TRUNCATE TABLE session_tags",
            "TRUNCATE TABLE session_windows",
            "TRUNCATE TABLE reading_sessions",
            "TRUNCATE TABLE books",
            "TRUNCATE TABLE users",
            "SET FOREIGN_KEY_CHECKS = 1"
        );
        IntegrationSchemaSupport.seedIntegrationUser(dataSource);
    }

    public static SessionGraph seedSessionGraph(
        BookMapper bookMapper,
        ReadingSessionMapper readingSessionMapper,
        SessionWindowMapper sessionWindowMapper
    ) {
        Long userId = 1L;

        BookRecord book = BookRecord.builder()
            .userId(userId)
            .title("Integration Session Book")
            .author("Fixture Author")
            .source("integration")
            .sourceRef("integration-session-book")
            .readingStatus(BookReadingStatus.WANT_TO_READ)
            .testData(true)
            .build();
        bookMapper.insert(book);

        ReadingSessionRecord session = ReadingSessionRecord.builder()
            .userId(userId)
            .bookId(book.getId())
            .title("Integration Session")
            .testData(true)
            .build();
        readingSessionMapper.insert(session);

        SessionWindowRecord window = SessionWindowRecord.builder()
            .sessionId(session.getId())
            .userId(userId)
            .windowType("reflection")
            .title("Reflection")
            .position(1)
            .status("open")
            .testData(true)
            .build();
        sessionWindowMapper.insert(window);

        return new SessionGraph(userId, book.getId(), session.getId(), window.getId());
    }
}
