package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.auth.mapper.AuthEmailVerificationMapper;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.model.AuthEmailVerificationRecord;
import com.margins.auth.model.UserRecord;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.book.model.BookReadingStatus;
import com.margins.memorycard.mapper.MemoryCardMapper;
import com.margins.memorycard.model.MemoryCardGroupRecord;
import com.margins.memorycard.model.MemoryCardRecord;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.mapper.SessionTagMapper;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.SessionTagRecord;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationFixtureSupport;
import com.margins.testsupport.IntegrationFixtureSupport.SessionGraph;
import com.margins.testsupport.IntegrationSchemaSupport;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MapperIntegrationTest extends AbstractMySqlIntegrationTest {

    private static final Long USER_ID = 1L;

    @Autowired
    private PersonaMapper personaMapper;

    @Autowired
    private BookMapper bookMapper;

    @Autowired
    private ReadingSessionMapper readingSessionMapper;

    @Autowired
    private SessionWindowMapper sessionWindowMapper;

    @Autowired
    private SessionTagMapper sessionTagMapper;

    @Autowired
    private MessageMapper messageMapper;

    @Autowired
    private MemoryCardMapper memoryCardMapper;

    @Autowired
    private AuthEmailVerificationMapper authEmailVerificationMapper;

    @Autowired
    private UserMapper userMapper;

    @Nested
    class AuthEmailVerificationMapperTests {

        @BeforeEach
        void resetEmailVerifications() throws Exception {
            IntegrationSchemaSupport.executeSql(
                dataSource,
                "TRUNCATE TABLE auth_email_verification_rate_limits",
                "TRUNCATE TABLE auth_email_verifications"
            );
        }

        @Test
        void supersededCodeIsNotAcceptedAsVerifiedAfterNewCodeIsIssued() {
            String email = "reader@example.com";
            String oldHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
            String newHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

            authEmailVerificationMapper.insert(emailVerification(email, oldHash));
            int expiredRows = authEmailVerificationMapper.expireActiveForEmail(email);
            authEmailVerificationMapper.insert(emailVerification(email, newHash));
            int confirmedRows = authEmailVerificationMapper.consumeActiveCode(email, newHash);

            assertThat(expiredRows).isEqualTo(1);
            assertThat(confirmedRows).isEqualTo(1);
            assertThat(authEmailVerificationMapper.countVerifiedCode(email, oldHash)).isZero();
            assertThat(authEmailVerificationMapper.countVerifiedCode(email, newHash)).isEqualTo(1);
        }

        @Test
        void fifthWrongAttemptInvalidatesCodeAndNewCodeCanBeConfirmed() {
            String email = "attempts@example.com";
            String oldHash = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
            String newHash = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
            authEmailVerificationMapper.insert(emailVerification(email, oldHash));

            for (int attempt = 0; attempt < 5; attempt += 1) {
                assertThat(authEmailVerificationMapper.recordFailedAttempt(email)).isEqualTo(1);
            }

            assertThat(authEmailVerificationMapper.consumeActiveCode(email, oldHash)).isZero();
            authEmailVerificationMapper.insert(emailVerification(email, newHash));
            assertThat(authEmailVerificationMapper.consumeActiveCode(email, newHash)).isEqualTo(1);
        }
    }

    @Nested
    class PersonaMapperTests {

        @BeforeEach
        void resetPersonas() throws Exception {
            IntegrationSchemaSupport.resetPersonas(dataSource);
        }

        @Test
        void insertAssignsGeneratedIdAndFindActiveReturnsPersistedPersona() {
            PersonaRecord inserted = samplePersona("literary-critic", "Literary Critic");

            int rows = personaMapper.insert(inserted);

            assertThat(rows).isEqualTo(1);
            assertThat(inserted.getId()).isPositive();

            List<PersonaRecord> active = personaMapper.findActive();
            assertThat(active).hasSize(1);
            assertThat(active.getFirst())
                .extracting(PersonaRecord::getName, PersonaRecord::getDisplayName, PersonaRecord::getSystemPrompt)
                .containsExactly("literary-critic", "Literary Critic", "Read as a literary critic.");
        }

        @Test
        void findActiveByIdReturnsMatchingActivePersona() {
            PersonaRecord inserted = PersonaRecord.builder()
                .name("historian")
                .displayName("Historian")
                .description("Integration persona")
                .systemPrompt("Read as a historian.")
                .tone("measured")
                .active(true)
                .build();
            personaMapper.insert(inserted);

            PersonaRecord found = personaMapper.findActiveById(inserted.getId());

            assertThat(found).isNotNull();
            assertThat(found.getName()).isEqualTo("historian");
            assertThat(found.getTone()).isEqualTo("measured");
        }

        @Test
        void findActiveExcludesSoftDeletedAndInactivePersonas() throws Exception {
            PersonaRecord active = samplePersona("psychologist", "Psychologist");
            personaMapper.insert(active);

            try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
                statement.execute(
                    "UPDATE personas SET deleted_at = CURRENT_TIMESTAMP WHERE id = " + active.getId()
                );
            }

            PersonaRecord inactive = samplePersona("inactive-persona", "Inactive");
            personaMapper.insert(inactive);
            try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
                statement.execute(
                    "UPDATE personas SET is_active = FALSE WHERE id = " + inactive.getId()
                );
            }

            assertThat(personaMapper.findActive()).isEmpty();
            assertThat(personaMapper.findActiveById(active.getId())).isNull();
            assertThat(personaMapper.findActiveById(inactive.getId())).isNull();
        }
    }

    @Nested
    class BookMapperTests {

        @BeforeEach
        void resetBooks() throws Exception {
            IntegrationSchemaSupport.resetBooksAndUsers(dataSource);
        }

        @Test
        void insertPersistsRawMetadataAndFindByIdForUserReturnsAliases() {
            BookRecord inserted = sampleBook("The Left Hand of Darkness", "Ursula K. Le Guin");

            bookMapper.insert(inserted);

            BookRecord found = bookMapper.findByIdForUser(inserted.getId(), USER_ID);

            assertThat(found).isNotNull();
            assertThat(found.getTitle()).isEqualTo("The Left Hand of Darkness");
            assertThat(found.getLanguageCode()).isEqualTo("en");
            assertThat(found.getCoverImageUrl()).isEqualTo("https://example.com/cover.jpg");
            assertThat(found.getRawMetadata()).contains("integration");
            assertThat(found.getReadingStatus()).isEqualTo(BookReadingStatus.WANT_TO_READ);
            assertThat(found.isTestData()).isTrue();
        }

        @Test
        void findDuplicateMatchesUserAndIsbn() {
            BookRecord inserted = sampleBook("Beloved", "Toni Morrison");
            inserted.setIsbn("9780679722762");
            bookMapper.insert(inserted);

            BookRecord duplicate = bookMapper.findDuplicateByIsbn(USER_ID, "9780679722762");

            assertThat(duplicate).isNotNull();
            assertThat(duplicate.getTitle()).isEqualTo("Beloved");
        }

        @Test
        void softDeleteRemovesBookFromActiveQueries() {
            BookRecord inserted = sampleBook("Pachinko", "Min Jin Lee");
            inserted.setIsbn("9780735224315");
            bookMapper.insert(inserted);

            int deletedRows = bookMapper.softDelete(inserted.getId(), USER_ID);

            assertThat(deletedRows).isEqualTo(1);
            assertThat(bookMapper.findByIdForUser(inserted.getId(), USER_ID)).isNull();
            assertThat(bookMapper.findByUserId(USER_ID, null, "recent")).isEmpty();
            assertThat(bookMapper.findDuplicateByIsbn(USER_ID, "9780735224315")).isNull();
        }

        @Test
        void findByUserIdAppliesShelfFilterAndSortInDatabase() {
            BookRecord read = sampleBook("B Book", "Author");
            read.setReadingStatus(BookReadingStatus.READ);
            read.setRating(3.0);
            bookMapper.insert(read);

            BookRecord highestRatedReading = sampleBook("A Book", "Author");
            highestRatedReading.setReadingStatus(BookReadingStatus.READING);
            highestRatedReading.setRating(5.0);
            bookMapper.insert(highestRatedReading);

            BookRecord lowerRatedReading = sampleBook("C Book", "Author");
            lowerRatedReading.setReadingStatus(BookReadingStatus.READING);
            lowerRatedReading.setRating(4.0);
            bookMapper.insert(lowerRatedReading);

            BookRecord wantToRead = sampleBook("D Book", "Author");
            wantToRead.setReadingStatus(BookReadingStatus.WANT_TO_READ);
            bookMapper.insert(wantToRead);

            bookMapper.updateShelf(read);
            bookMapper.updateShelf(highestRatedReading);
            bookMapper.updateShelf(lowerRatedReading);

            List<BookRecord> filtered = bookMapper.findByUserId(USER_ID, BookReadingStatus.READING, "rating_desc");

            assertThat(filtered)
                .extracting(BookRecord::getId)
                .containsExactly(highestRatedReading.getId(), lowerRatedReading.getId());
            assertThat(bookMapper.findByUserId(USER_ID, null, "title_asc"))
                .extracting(BookRecord::getId)
                .containsExactly(highestRatedReading.getId(), read.getId(), lowerRatedReading.getId(), wantToRead.getId());
            assertThat(bookMapper.findByUserId(USER_ID, null, "title_desc"))
                .extracting(BookRecord::getId)
                .containsExactly(wantToRead.getId(), lowerRatedReading.getId(), read.getId(), highestRatedReading.getId());
            assertThat(bookMapper.findByUserId(USER_ID, null, "rating_asc"))
                .extracting(BookRecord::getId)
                .containsExactly(read.getId(), lowerRatedReading.getId(), highestRatedReading.getId(), wantToRead.getId());
            assertThat(bookMapper.findByUserId(USER_ID, null, "status"))
                .extracting(BookRecord::getReadingStatus)
                .containsExactly(
                    BookReadingStatus.READING,
                    BookReadingStatus.READING,
                    BookReadingStatus.WANT_TO_READ,
                    BookReadingStatus.READ
                );
        }
    }

    @Nested
    class SessionTagMapperTests {

        private SessionGraph graph;

        @BeforeEach
        void resetAndSeed() throws Exception {
            IntegrationFixtureSupport.resetSessionGraph(dataSource);
            graph = IntegrationFixtureSupport.seedSessionGraph(bookMapper, readingSessionMapper, sessionWindowMapper);
        }

        @Test
        void insertAndFindBySessionIdReturnsOrderedLabels() {
            sessionTagMapper.insert(buildTag(graph, "theme-memory"));
            sessionTagMapper.insert(buildTag(graph, "archive"));

            List<SessionTagRecord> tags = sessionTagMapper.findBySessionId(graph.sessionId(), graph.userId());

            assertThat(tags).hasSize(2);
            assertThat(tags)
                .extracting(SessionTagRecord::getLabel)
                .containsExactly("archive", "theme-memory");
        }

        @Test
        void findBySessionIdsReturnsTagsForRequestedSessionsOnly() {
            sessionTagMapper.insert(buildTag(graph, "selected"));

            SessionGraph otherGraph = IntegrationFixtureSupport.seedSessionGraph(
                bookMapper,
                readingSessionMapper,
                sessionWindowMapper
            );
            sessionTagMapper.insert(buildTag(otherGraph, "other"));

            List<SessionTagRecord> tags = sessionTagMapper.findBySessionIds(
                List.of(graph.sessionId()),
                graph.userId()
            );

            assertThat(tags).hasSize(1);
            assertThat(tags.getFirst().getLabel()).isEqualTo("selected");
        }

        @Test
        void softDeleteRemovesTagFromActiveQueries() {
            SessionTagRecord tag = buildTag(graph, "temporary");
            sessionTagMapper.insert(tag);

            int deletedRows = sessionTagMapper.softDelete(graph.sessionId(), tag.getId(), graph.userId());

            assertThat(deletedRows).isEqualTo(1);
            assertThat(sessionTagMapper.findBySessionId(graph.sessionId(), graph.userId())).isEmpty();
        }
    }

    @Nested
    class MemoryCardMapperTests {

        @BeforeEach
        void resetMemoryCards() throws Exception {
            IntegrationSchemaSupport.executeSql(
                dataSource,
                "DELETE FROM memory_cards WHERE is_test_data = TRUE",
                "DELETE FROM memory_card_groups WHERE is_test_data = TRUE"
            );
        }

        @Test
        void insertGroupAssignsGeneratedIdAndFindGroupReturnsPersistedGroup() {
            MemoryCardGroupRecord group = memoryCardGroup("Harry Potter vocabulary");

            int rows = memoryCardMapper.insertGroup(group);

            assertThat(rows).isEqualTo(1);
            assertThat(group.getId()).isPositive();
            assertThat(memoryCardMapper.findGroup(group.getId(), USER_ID))
                .extracting(MemoryCardGroupRecord::getTitle)
                .isEqualTo("Harry Potter vocabulary");
        }

        @Test
        void insertCardAndFindGroupsReturnActiveCardCounts() {
            MemoryCardGroupRecord group = memoryCardGroup("Chapter words");
            memoryCardMapper.insertGroup(group);
            memoryCardMapper.insertCard(memoryCard(group.getId(), "wand", "지팡이", 1));
            memoryCardMapper.insertCard(memoryCard(group.getId(), "cloak", "망토", 2));

            List<MemoryCardRecord> cards = memoryCardMapper.findCards(group.getId());

            assertThat(cards).extracting(MemoryCardRecord::getFrontText).containsExactly("wand", "cloak");
            assertThat(cards).extracting(MemoryCardRecord::getMemorized).containsExactly(false, false);
            MemoryCardRecord memorizedUpdate = MemoryCardRecord.builder()
                .id(cards.get(0).getId())
                .groupId(group.getId())
                .memorized(true)
                .build();
            assertThat(memoryCardMapper.updateCardMemorized(memorizedUpdate)).isEqualTo(1);
            assertThat(memoryCardMapper.findCards(group.getId()).get(0).getMemorized()).isTrue();
            assertThat(memoryCardMapper.findGroups(USER_ID))
                .singleElement()
                .extracting(MemoryCardGroupRecord::getCardCount)
                .isEqualTo(2);
        }
    }

    @Nested
    class MessageMapperTests {

        private SessionGraph graph;

        @BeforeEach
        void resetAndSeed() throws Exception {
            IntegrationFixtureSupport.resetSessionGraph(dataSource);
            graph = IntegrationFixtureSupport.seedSessionGraph(bookMapper, readingSessionMapper, sessionWindowMapper);
        }

        @Test
        void insertAndSelectNextOrderIncrementPerWindow() {
            MessageRecord first = userMessage(graph, "First answer", 1);
            MessageRecord second = userMessage(graph, "Second answer", 2);

            messageMapper.insert(first);
            messageMapper.insert(second);

            assertThat(messageMapper.selectNextOrder(graph.sessionId(), graph.windowId())).isEqualTo(3);
            assertThat(messageMapper.findBySessionId(graph.sessionId()))
                .extracting(MessageRecord::getContent)
                .containsExactly("First answer", "Second answer");
        }

        @Test
        void findBySessionIdIgnoresMessagesInArchivedWindows() throws Exception {
            messageMapper.insert(userMessage(graph, "Visible answer", 1));

            IntegrationSchemaSupport.executeSql(
                dataSource,
                "UPDATE session_windows SET deleted_at = CURRENT_TIMESTAMP WHERE id = " + graph.windowId()
            );

            assertThat(messageMapper.findBySessionId(graph.sessionId())).isEmpty();
        }

        @Test
        void updateContentAndSoftDeleteUserMessageWithReplies() {
            MessageRecord user = userMessage(graph, "Draft answer", 1);
            messageMapper.insert(user);

            MessageRecord assistantReply = MessageRecord.builder()
                .sessionId(graph.sessionId())
                .windowId(graph.windowId())
                .userId(graph.userId())
                .parentMessageId(user.getId())
                .role("assistant")
                .content("Assistant follow-up")
                .messageOrder(2)
                .streamingStatus("complete")
                .testData(true)
                .build();
            messageMapper.insert(assistantReply);

            int updatedRows = messageMapper.updateContent(user.getId(), graph.userId(), "Final answer");
            MessageRecord editable = messageMapper.findEditableById(user.getId(), graph.userId());

            assertThat(updatedRows).isEqualTo(1);
            assertThat(editable.getContent()).isEqualTo("Final answer");

            int deletedRows = messageMapper.softDelete(user.getId(), graph.userId());

            assertThat(deletedRows).isEqualTo(2);
            assertThat(messageMapper.findBySessionId(graph.sessionId())).isEmpty();
            assertThat(messageMapper.findEditableById(user.getId(), graph.userId())).isNull();
        }

        @Test
        void invalidatesConversationSummaryThatIncludesChangedMessage() {
            MessageRecord user = userMessage(graph, "Summarized answer", 1);
            messageMapper.insert(user);
            sessionWindowMapper.updateContextSnapshot(
                graph.windowId(),
                "{\"conversationSummary\":{\"content\":\"Old summary\",\"lastMessageId\":"
                    + user.getId() + "},\"topic\":\"Keep me\"}"
            );

            int updatedRows = messageMapper.invalidateConversationSummary(graph.windowId(), user.getId());
            String snapshot = sessionWindowMapper.findContextById(graph.windowId()).getWindowContextSnapshot();

            assertThat(updatedRows).isEqualTo(1);
            assertThat(snapshot).doesNotContain("conversationSummary");
            assertThat(snapshot).contains("Keep me");
        }
    }

    private static PersonaRecord samplePersona(String name, String displayName) {
        return PersonaRecord.builder()
            .name(name)
            .displayName(displayName)
            .description("Integration persona")
            .systemPrompt("Read as a literary critic.")
            .tone("measured")
            .active(true)
            .build();
    }

    private static BookRecord sampleBook(String title, String author) {
        return BookRecord.builder()
            .userId(USER_ID)
            .title(title)
            .author(author)
            .languageCode("en")
            .description("Integration book")
            .source("integration")
            .sourceRef("integration-book")
            .coverImageUrl("https://example.com/cover.jpg")
            .rawMetadata("{\"source\":\"integration\"}")
            .testData(true)
            .build();
    }

    private static SessionTagRecord buildTag(SessionGraph graph, String label) {
        return SessionTagRecord.builder()
            .sessionId(graph.sessionId())
            .userId(graph.userId())
            .label(label)
            .testData(true)
            .build();
    }

    private static MemoryCardGroupRecord memoryCardGroup(String title) {
        return MemoryCardGroupRecord.builder()
            .userId(USER_ID)
            .title(title)
            .description("Integration group")
            .sourceLabel("integration")
            .testData(true)
            .build();
    }

    private static MemoryCardRecord memoryCard(Long groupId, String frontText, String backText, int position) {
        return MemoryCardRecord.builder()
            .groupId(groupId)
            .frontText(frontText)
            .backText(backText)
            .position(position)
            .testData(true)
            .build();
    }

    private static MessageRecord userMessage(SessionGraph graph, String content, int order) {
        return MessageRecord.builder()
            .sessionId(graph.sessionId())
            .windowId(graph.windowId())
            .userId(graph.userId())
            .role("user")
            .content(content)
            .messageOrder(order)
            .streamingStatus("complete")
            .testData(true)
            .build();
    }

    private static AuthEmailVerificationRecord emailVerification(String email, String codeHash) {
        return AuthEmailVerificationRecord.builder()
            .email(email)
            .codeHash(codeHash)
            .expiresAt(Instant.now().plusSeconds(300))
            .testData(true)
            .build();
    }

}
