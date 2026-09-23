package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.book.mapper.BookMapper;
import com.margins.book.mapper.LibraryThreadMapper;
import com.margins.book.model.BookRecord;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.mapper.SessionInsightMapper;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.ReadingSessionRecord;
import com.margins.session.model.SessionInsightRecord;
import com.margins.session.model.SessionWindowRecord;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationSchemaSupport;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class LibraryThreadMapperIntegrationTest extends AbstractMySqlIntegrationTest {

    @Autowired
    private BookMapper bookMapper;

    @Autowired
    private LibraryThreadMapper libraryThreadMapper;

    @Autowired
    private ReadingSessionMapper readingSessionMapper;

    @Autowired
    private SessionWindowMapper sessionWindowMapper;

    @Autowired
    private SessionInsightMapper sessionInsightMapper;

    @Autowired
    private ReflectionRevisionMapper reflectionRevisionMapper;

    @Autowired
    private ReflectionInterviewMapper reflectionInterviewMapper;

    @BeforeEach
    void reset() throws Exception {
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "SET FOREIGN_KEY_CHECKS = 0",
            "TRUNCATE TABLE discussion_runs",
            "TRUNCATE TABLE discussion_guide_items",
            "TRUNCATE TABLE discussion_guides",
            "TRUNCATE TABLE reflection_interview_answer_revisions",
            "TRUNCATE TABLE reflection_interviews",
            "TRUNCATE TABLE reflection_revisions",
            "TRUNCATE TABLE session_insights",
            "TRUNCATE TABLE questions",
            "TRUNCATE TABLE session_windows",
            "TRUNCATE TABLE reading_sessions",
            "TRUNCATE TABLE books",
            "TRUNCATE TABLE users",
            "SET FOREIGN_KEY_CHECKS = 1"
        );
        IntegrationSchemaSupport.seedIntegrationUser(dataSource);
    }

    @Test
    void projectsAThreadWithoutFanOutWhenTheBookHasNoReflectionYet() {
        BookRecord book = book("A first thread");
        bookMapper.insert(book);

        var rows = libraryThreadMapper.findThreads(1L, "reading", null, "recent", 51, 0);

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getBookId()).isEqualTo(book.getId());
        assertThat(rows.getFirst().getReflectionId()).isNull();
        assertThat(libraryThreadMapper.findRecentRevisions(1L, List.of(book.getId()))).isEmpty();
        assertThat(libraryThreadMapper.findThreads(1L, null, "REFLECT", "recent", 51, 0))
            .extracting("bookId")
            .containsExactly(book.getId());
        assertThat(libraryThreadMapper.countByShelf(1L)).singleElement().satisfies(count -> {
            assertThat(count.getCategory()).isEqualTo("reading");
            assertThat(count.getTotal()).isEqualTo(1L);
        });
        assertThat(libraryThreadMapper.countByStage(1L)).singleElement().satisfies(count -> {
            assertThat(count.getCategory()).isEqualTo("REFLECT");
            assertThat(count.getTotal()).isEqualTo(1L);
        });
    }

    @Test
    void projectsTheLatestReflectionRevisionAndInterviewWithoutReturningRevisionBodies()
        throws Exception {
        BookRecord book = book("A continuing thread");
        bookMapper.insert(book);
        ReadingSessionRecord session = ReadingSessionRecord.builder()
            .userId(1L)
            .bookId(book.getId())
            .title("Thread session")
            .testData(true)
            .build();
        readingSessionMapper.insert(session);
        SessionWindowRecord window = SessionWindowRecord.builder()
            .sessionId(session.getId())
            .userId(1L)
            .windowType("reflection")
            .title("Reflection")
            .position(1)
            .status("open")
            .testData(true)
            .build();
        sessionWindowMapper.insert(window);
        SessionInsightRecord reflection = SessionInsightRecord.builder()
            .sessionId(session.getId())
            .userId(1L)
            .insightType("reflection")
            .title("Primary Reflection")
            .content("This private body must not enter a Library summary.")
            .visibility("PRIVATE")
            .insightOrder(1)
            .testData(true)
            .build();
        sessionInsightMapper.insert(reflection);
        ReflectionRevisionRecord first = revision(reflection.getId(), session.getId(), 1);
        reflectionRevisionMapper.insertRevision(first);
        ReflectionRevisionRecord second = revision(reflection.getId(), session.getId(), 2);
        reflectionRevisionMapper.insertRevision(second);
        ReflectionInterviewRecord interview = ReflectionInterviewRecord.builder()
            .reflectionInsightId(reflection.getId())
            .sourceRevisionId(second.getId())
            .sessionId(session.getId())
            .windowId(window.getId())
            .userId(1L)
            .status("ACTIVE")
            .coverageJson("[]")
            .answeredCount(2)
            .skippedCount(0)
            .generatedCount(3)
            .promptVersion("integration-v1")
            .testData(true)
            .build();
        reflectionInterviewMapper.insertInterview(interview);

        var rows = libraryThreadMapper.findThreads(1L, null, null, "recent", 51, 0);
        var summaries = libraryThreadMapper.findRecentRevisions(1L, List.of(book.getId()));

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getReflectionId()).isEqualTo(reflection.getId());
            assertThat(row.getCurrentRevisionId()).isEqualTo(second.getId());
            assertThat(row.getCurrentRevisionNumber()).isEqualTo(2);
            assertThat(row.getInterviewId()).isEqualTo(interview.getId());
            assertThat(row.getAnsweredCount()).isEqualTo(2);
        });
        assertThat(summaries).extracting("version").containsExactly(2, 1);
        assertThat(libraryThreadMapper.findThreads(1L, null, "INTERVIEW", "recent", 51, 0))
            .extracting("bookId")
            .containsExactly(book.getId());
        assertThat(libraryThreadMapper.findThreads(1L, null, "REFLECT", "recent", 51, 0)).isEmpty();
        assertThat(libraryThreadMapper.findRecentActivity(1L, 30))
            .extracting("revisionId")
            .containsExactly(second.getId(), first.getId());

        IntegrationSchemaSupport.executeSql(
            dataSource,
            "UPDATE session_insights SET deleted_at = CURRENT_TIMESTAMP WHERE id = "
                + reflection.getId()
        );
        assertThat(libraryThreadMapper.findRecentActivity(1L, 30)).isEmpty();
        assertThat(libraryThreadMapper.findRecentRevisions(1L, List.of(book.getId()))).isEmpty();
    }

    @Test
    void projectsTheExplicitCurrentSessionInsteadOfAYoungerSession() {
        BookRecord book = book("A stable current thread");
        bookMapper.insert(book);
        ReadingSessionRecord current = session(book.getId(), "Selected session");
        ReadingSessionRecord younger = session(book.getId(), "Younger session");
        readingSessionMapper.insert(current);
        readingSessionMapper.insert(younger);

        assertThat(readingSessionMapper.updateCurrentForBook(book.getId(), 1L, current.getId()))
            .isEqualTo(1);

        assertThat(libraryThreadMapper.findThreads(1L, null, null, "recent", 51, 0))
            .singleElement()
            .extracting("sessionId")
            .isEqualTo(current.getId());
    }

    @Test
    void fallsBackToTheLatestActiveSessionWhenThePointerIsInvalid() throws Exception {
        BookRecord book = book("A recoverable current thread");
        bookMapper.insert(book);
        ReadingSessionRecord stale = session(book.getId(), "Stale selected session");
        ReadingSessionRecord fallback = session(book.getId(), "Fallback session");
        readingSessionMapper.insert(stale);
        readingSessionMapper.insert(fallback);
        assertThat(readingSessionMapper.updateCurrentForBook(book.getId(), 1L, stale.getId()))
            .isEqualTo(1);
        IntegrationSchemaSupport.executeSql(
            dataSource,
            "UPDATE reading_sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = " + stale.getId()
        );
        SessionInsightRecord reflection = SessionInsightRecord.builder()
            .sessionId(fallback.getId())
            .userId(1L)
            .insightType("reflection")
            .title("Recovered reflection")
            .content("Fallback identity remains usable.")
            .visibility("PRIVATE")
            .insightOrder(1)
            .testData(true)
            .build();
        sessionInsightMapper.insert(reflection);
        reflectionRevisionMapper.insertRevision(revision(reflection.getId(), fallback.getId(), 1));

        assertThat(libraryThreadMapper.findThreads(1L, null, null, "recent", 51, 0))
            .singleElement()
            .satisfies(row -> {
                assertThat(row.getSessionId()).isEqualTo(fallback.getId());
                assertThat(row.getReflectionId()).isEqualTo(reflection.getId());
            });
        assertThat(libraryThreadMapper.countByStage(1L))
            .singleElement()
            .satisfies(count -> assertThat(count.getCategory()).isEqualTo("INTERVIEW"));
    }

    private BookRecord book(String title) {
        return BookRecord.builder()
            .userId(1L)
            .title(title)
            .author("Reader")
            .readingStatus("reading")
            .source("manual")
            .sourceRef("manual-thread")
            .rawMetadata("{}")
            .testData(true)
            .build();
    }

    private ReflectionRevisionRecord revision(Long reflectionId, Long sessionId, int version) {
        return ReflectionRevisionRecord.builder()
            .reflectionInsightId(reflectionId)
            .sessionId(sessionId)
            .userId(1L)
            .version(version)
            .content("Private revision " + version)
            .revisionSource(version == 1 ? "INITIAL" : "USER_EDIT")
            .testData(true)
            .build();
    }

    private ReadingSessionRecord session(Long bookId, String title) {
        return ReadingSessionRecord.builder()
            .userId(1L)
            .bookId(bookId)
            .title(title)
            .testData(true)
            .build();
    }
}
