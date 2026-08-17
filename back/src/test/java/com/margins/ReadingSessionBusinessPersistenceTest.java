package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.margins.testsupport.TestSecurityContextSupport;

import com.margins.message.mapper.MessageMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.message.model.MessageRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.mapper.QuestionMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.question.model.QuestionRecord;
import com.margins.question.dto.SaveQuestionAnswerRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.business.ReadingSessionBusiness;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateReadingSessionRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateReadingSessionResponse;
import com.margins.session.dto.CreateReviewCommentRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateSessionHighlightRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateSessionInsightRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.CreateSessionTagRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.ReadingSessionTimelineResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.UpdateSessionHighlightRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.UpdateSessionInsightRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.UpdateReadingSessionTitleRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.mapper.ReviewCommentMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.SessionHighlightMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.SessionInsightMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.SessionSearchMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.SessionTagMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.ReadingSessionRecord;
import com.margins.session.model.ReviewCommentRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionHighlightRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionInsightRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionSearchResultRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionTagRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionWindowContext;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.model.SessionWindowRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.io.IOException;
import java.util.List;
import java.nio.file.Files;
import java.nio.file.Path;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.http.HttpStatus;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.web.server.ResponseStatusException;
import com.margins.testsupport.TestSecurityContextSupport;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class ReadingSessionBusinessPersistenceTest {

    @Test
    void createPersistsAndReturnsGeneratedId() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        CreateReadingSessionResponse response = business.create(CreateReadingSessionRequest.builder()
            .bookId(7L)
            .title("My Session")
            .build());

        assertThat(response.getSessionId()).isEqualTo(77L);
        assertThat(response.getBookId()).isEqualTo(7L);

        assertThat(mapper.inserted.getUserId()).isEqualTo(1L);
        assertThat(mapper.inserted.isTestData()).isTrue();
    }

    @Test
    void ensureForBookInheritsOwningBookTestDataMarkerForReset() throws IOException {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        mapper.owningBookTestData = true;
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        ReadingSessionRecord session = business.ensureForBook(7L, 1L);

        assertThat(session.isTestData()).isTrue();
        assertThat(mapper.inserted.isTestData()).isTrue();
        assertThat(Files.readString(Path.of("../db/reset/001_reset_test_data.sql")))
            .contains("DELETE FROM reading_sessions WHERE is_test_data = TRUE");
    }

    @Test
    void createRejectsMissingBookBeforeInsert() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        mapper.activeBookCount = 0;
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        assertNotFound("Book not found", () -> business.create(CreateReadingSessionRequest.builder()
            .bookId(404L)
            .title("Missing book session")
            .build()));
        assertThat(mapper.inserted).isNull();
    }

    @Test
    void createRejectsZeroRowInsert() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        mapper.insertRows = 0;
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        assertServerError("Reading session could not be saved", () -> business.create(CreateReadingSessionRequest.builder()
            .bookId(7L)
            .title("My Session")
            .build()));
    }

    @Test
    void findLatestTimelineReturnsSessionWindowsAndMessages() {
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper());

        ReadingSessionTimelineResponse response = business.findLatestTimeline();

        assertThat(response.getSessionId()).isEqualTo(77L);
        assertThat(response.getBookTitle()).isEqualTo("Seed Book");
        assertThat(response.getWindows()).hasSize(1);
        assertThat(response.getHighlights()).hasSize(1);
        assertThat(response.getTags()).extracting("label").containsExactly("politics");
        assertThat(response.getInsights()).extracting("content").containsExactly("Power is staged before it is explained.");
        assertThat(response.getQuestions()).hasSize(1);
        assertThat(response.getMessages()).hasSize(1);
        assertThat(response.getStats().getQuestionCount()).isEqualTo(1);
        assertThat(response.getStats().getAnsweredQuestionCount()).isEqualTo(1);
        assertThat(response.getStats().getPersonaCount()).isZero();
        assertThat(response.getMessages().get(0).getContent()).isEqualTo("Saved reflection");
        assertThat(response.getNextActions()).extracting("actionId").contains("ask_persona");
    }

    @Test
    void timelineNextActionsGuideEmptyActiveSession() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        ReadingSessionBusiness business = business(
            mapper,
            new EmptySessionWindowMapper(),
            new EmptySessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            new FakeSessionSearchMapper(),
            new FakeSessionTagMapper(),
            new EmptyMessageMapper(),
            new EmptyQuestionMapper()
        );

        ReadingSessionTimelineResponse response = business.findTimeline(77L);

        assertThat(response.getNextActions()).extracting("actionId").containsExactly(
            "generate_questions",
            "save_highlight",
            "ask_persona"
        );
    }


    @Test
    void findTimelineReturnsRequestedSession() {
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper());

        ReadingSessionTimelineResponse response = business.findTimeline(77L);

        assertThat(response.getSessionId()).isEqualTo(77L);
        assertThat(response.getBookTitle()).isEqualTo("Seed Book");
    }

    @Test
    void findSummariesReturnsSessionLibrary() {
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper());

        assertThat(business.findSummaries().getSessions()).hasSize(1);
        assertThat(business.findSummaries().getSessions().get(0).getMessageCount()).isEqualTo(2);
        assertThat(business.findSummaries().getSessions().get(0).getHighlightCount()).isEqualTo(1);
        assertThat(business.findSummaries().getSessions().get(0).getAnsweredQuestionCount()).isEqualTo(1);

        assertThat(business.findSummaries().getSessions().get(0).getTags()).extracting("label").containsExactly("politics");
    }

    @Test
    void findLibraryStatsAggregatesSavedSessionSummaries() {
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper());

        assertThat(business.findLibraryStats())
            .satisfies((stats) -> {
                assertThat(stats.getSessionCount()).isEqualTo(1);

                assertThat(stats.getDistinctBookCount()).isEqualTo(1);
                assertThat(stats.getAnsweredQuestionCount()).isEqualTo(1);
                assertThat(stats.getHighlightCount()).isEqualTo(1);
                assertThat(stats.getMessageCount()).isEqualTo(2);

            });
    }

    @Test
    void searchReturnsReadingMemoryMatches() {
        FakeSessionSearchMapper searchMapper = new FakeSessionSearchMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), new FakeSessionInsightMapper(), searchMapper, new FakeSessionTagMapper());

        assertThat(business.search(" ceremony ").getResults()).singleElement()
            .satisfies((result) -> {
                assertThat(result.getSessionId()).isEqualTo(77L);
                assertThat(result.getResultType()).isEqualTo("insight");
                assertThat(result.getBookTitle()).isEqualTo("Seed Book");
                assertThat(result.getSnippet()).contains("ceremony");
            });
        assertThat(searchMapper.query).isEqualTo("ceremony");
        assertThat(searchMapper.limit).isEqualTo(30);
    }

    @Test
    void searchReturnsEmptyForBlankQuery() {
        FakeSessionSearchMapper searchMapper = new FakeSessionSearchMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), new FakeSessionInsightMapper(), searchMapper, new FakeSessionTagMapper());

        assertThat(business.search(" ").getResults()).isEmpty();
        assertThat(searchMapper.query).isNull();
    }

    @Test
    void findPublicReviewsReturnsOnlyPublicReviewProjection() {
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), insightMapper, new FakeSessionTagMapper());

        assertThat(business.findPublicReviews().getReviews()).singleElement()
            .satisfies((review) -> {
                assertThat(review.getInsightId()).isEqualTo(166L);
                assertThat(review.getSessionId()).isEqualTo(77L);
                assertThat(review.getBookId()).isEqualTo(7L);
                assertThat(review.getBookTitle()).isEqualTo("Seed Book");
                assertThat(review.getSessionTitle()).isEqualTo("My Session");
                assertThat(review.getTitle()).isEqualTo("Public ritual note");
                assertThat(review.getContent()).isEqualTo("Public reading review.");
                assertThat(review.getAuthorName()).isEqualTo("Public Reader");
                assertThat(review.getReviewedOn()).isEqualTo("2026-07-03");
            });
        assertThat(insightMapper.publicReviewLimit).isEqualTo(30);
    }

    @Test
    void createReviewCommentStoresTrimmedCommentAndReturnsThread() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertThat(business.createReviewComment(166L, CreateReviewCommentRequest.builder()
                .content("  I read this the same way.  ")
                .build())
            .getComments())
            .anySatisfy((comment) -> {
                assertThat(comment.getContent()).isEqualTo("I read this the same way.");
                assertThat(comment.isOwnedByCurrentReader()).isTrue();
            });
        assertThat(commentMapper.inserted.getInsightId()).isEqualTo(166L);
        assertThat(commentMapper.inserted.getUserId()).isEqualTo(1L);
        assertThat(commentMapper.inserted.getContent()).isEqualTo("I read this the same way.");
        assertThat(commentMapper.inserted.isTestData()).isTrue();
    }

    @Test
    void createReviewReplyRequiresActiveParentInSamePublicReview() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        commentMapper.activeParentCount = 0;
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertNotFound("Parent review comment not found", () -> business.createReviewComment(166L, CreateReviewCommentRequest.builder()
            .parentCommentId(900L)
            .content("Reply")
            .build()));
    }

    @Test
    void publicReviewCommentsRequireVisiblePublicReview() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        commentMapper.publicReviewCount = 0;
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertNotFound("Public review not found", () -> business.findReviewComments(404L));
        assertNotFound("Public review not found", () -> business.createReviewComment(404L, CreateReviewCommentRequest.builder()
            .content("Hidden review")
            .build()));
    }

    @Test
    void deleteReviewCommentSoftDeletesCommentAndReplies() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertThat(business.deleteReviewComment(166L, 300L).getComments()).isEmpty();
        assertThat(commentMapper.deletedInsightId).isEqualTo(166L);
        assertThat(commentMapper.deletedCommentId).isEqualTo(300L);
        assertThat(commentMapper.deletedUserId).isEqualTo(1L);
    }

    @Test
    void updateReviewCommentStoresTrimmedContentAndReturnsThread() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertThat(business.updateReviewComment(166L, 300L, com.margins.session.dto.UpdateReviewCommentRequest.builder()
                .content("  Edited comment  ")
                .build())
            .getComments())
            .extracting("content")
            .containsExactly("Edited comment");
        assertThat(commentMapper.updatedInsightId).isEqualTo(166L);
        assertThat(commentMapper.updatedCommentId).isEqualTo(300L);
        assertThat(commentMapper.updatedUserId).isEqualTo(1L);
        assertThat(commentMapper.updatedContent).isEqualTo("Edited comment");
    }

    @Test
    void deleteReviewCommentRequiresOwnedActiveComment() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        commentMapper.deletedRows = 0;
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertNotFound("Review comment not found", () -> business.deleteReviewComment(166L, 404L));
    }

    @Test
    void updateReviewCommentRequiresOwnedActiveComment() {
        FakeReviewCommentMapper commentMapper = new FakeReviewCommentMapper();
        commentMapper.updatedRows = 0;
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionHighlightMapper(),
            new FakeSessionInsightMapper(),
            commentMapper,
            new FakeSessionTagMapper()
        );

        assertNotFound("Review comment not found", () -> business.updateReviewComment(166L, 404L, com.margins.session.dto.UpdateReviewCommentRequest.builder()
            .content("Missing")
            .build()));
    }


    @Test
    void archiveSoftDeletesSessionAndReturnsUpdatedLibrary() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        assertThat(business.archive(77L).getSessions()).isEmpty();

        assertThat(mapper.deletedSessionId).isEqualTo(77L);
        assertThat(mapper.deletedUserId).isEqualTo(1L);
    }

    @Test
    void updateTitleStoresSessionTitleAndReturnsTimeline() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        ReadingSessionTimelineResponse response = business.updateTitle(77L, UpdateReadingSessionTitleRequest.builder()
            .title("Opening power notes")
            .build());

        assertThat(mapper.updatedTitle).isEqualTo("Opening power notes");
        assertThat(mapper.updatedTitleSessionId).isEqualTo(77L);
        assertThat(mapper.updatedTitleUserId).isEqualTo(1L);
        assertThat(response.getTitle()).isEqualTo("Opening power notes");
    }


    @Test
    void missingSessionMutationsReturnNotFound() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        mapper.updatedRows = 0;
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        assertNotFound("Reading session not found", () -> business.archive(404L));
        assertNotFound("Reading session not found", () -> business.updateTitle(404L, UpdateReadingSessionTitleRequest.builder()
            .title("Missing")
            .build()));

    }

    private void assertNotFound(String reason, Runnable action) {
        assertThatThrownBy(action::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(responseStatusException.getReason()).isEqualTo(reason);
            });
    }

    private void assertBadRequest(String reason, Runnable action) {
        assertThatThrownBy(action::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(responseStatusException.getReason()).isEqualTo(reason);
            });
    }

    private void assertServerError(String reason, Runnable action) {
        assertThatThrownBy(action::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> {
                ResponseStatusException responseStatusException = (ResponseStatusException) exception;
                assertThat(responseStatusException.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(responseStatusException.getReason()).isEqualTo(reason);
            });
    }

    @Test
    void createHighlightStoresQuoteAndReturnsTimeline() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        FakeSessionHighlightMapper highlightMapper = new FakeSessionHighlightMapper();
        ReadingSessionBusiness business = business(mapper, highlightMapper);

        ReadingSessionTimelineResponse response = business.createHighlight(77L, CreateSessionHighlightRequest.builder()
            .pageNumber(18)
            .locationLabel("Chapter 2")
            .quoteText("Fear is the mind-killer.")
            .note("Use this as evidence for discipline.")
            .build());

        assertThat(highlightMapper.inserted.getSessionId()).isEqualTo(77L);
        assertThat(highlightMapper.inserted.getBookId()).isEqualTo(7L);
        assertThat(highlightMapper.inserted.getHighlightOrder()).isEqualTo(2);
        assertThat(response.getHighlights()).extracting("quoteText").contains("Fear is the mind-killer.");
    }

    @Test
    void createHighlightRejectsZeroRowInsert() {
        FakeSessionHighlightMapper highlightMapper = new FakeSessionHighlightMapper();
        highlightMapper.insertRows = 0;
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), highlightMapper);

        assertServerError("Session highlight could not be saved", () -> business.createHighlight(77L, CreateSessionHighlightRequest.builder()
            .quoteText("Fear is the mind-killer.")
            .build()));
    }

    @Test
    void updateHighlightStoresEditedQuoteAndReturnsTimeline() {
        FakeSessionHighlightMapper highlightMapper = new FakeSessionHighlightMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), highlightMapper);

        ReadingSessionTimelineResponse response = business.updateHighlight(77L, 100L, UpdateSessionHighlightRequest.builder()
            .pageNumber(19)
            .locationLabel("Chapter 2 revised")
            .quoteText("Fear is the mind-killer, revised.")
            .note("Corrected evidence note.")
            .build());

        assertThat(highlightMapper.updatedSessionId).isEqualTo(77L);
        assertThat(highlightMapper.updatedHighlightId).isEqualTo(100L);
        assertThat(highlightMapper.updatedUserId).isEqualTo(1L);
        assertThat(response.getHighlights()).singleElement()
            .satisfies((highlight) -> {
                assertThat(highlight.getPageNumber()).isEqualTo(19);
                assertThat(highlight.getLocationLabel()).isEqualTo("Chapter 2 revised");
                assertThat(highlight.getQuoteText()).isEqualTo("Fear is the mind-killer, revised.");
                assertThat(highlight.getNote()).isEqualTo("Corrected evidence note.");
            });
    }

    @Test
    void deleteHighlightSoftDeletesQuoteAndReturnsTimeline() {
        FakeSessionHighlightMapper highlightMapper = new FakeSessionHighlightMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), highlightMapper);

        ReadingSessionTimelineResponse response = business.deleteHighlight(77L, 100L);

        assertThat(highlightMapper.deletedSessionId).isEqualTo(77L);
        assertThat(highlightMapper.deletedHighlightId).isEqualTo(100L);
        assertThat(highlightMapper.deletedUserId).isEqualTo(1L);
        assertThat(response.getHighlights()).isEmpty();
    }

    @Test
    void createTagStoresTrimmedLabelAndReturnsTimeline() {
        FakeSessionTagMapper tagMapper = new FakeSessionTagMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), tagMapper);

        ReadingSessionTimelineResponse response = business.createTag(77L, CreateSessionTagRequest.builder()
            .label("  theme  ")
            .build());

        assertThat(tagMapper.inserted.getSessionId()).isEqualTo(77L);
        assertThat(tagMapper.inserted.getUserId()).isEqualTo(1L);
        assertThat(tagMapper.inserted.getLabel()).isEqualTo("theme");
        assertThat(tagMapper.inserted.isTestData()).isTrue();
        assertThat(response.getTags()).extracting("label").contains("theme");
    }

    @Test
    void createTagRejectsZeroRowInsert() {
        FakeSessionTagMapper tagMapper = new FakeSessionTagMapper();
        tagMapper.insertRows = 0;
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), tagMapper);

        assertServerError("Session tag could not be saved", () -> business.createTag(77L, CreateSessionTagRequest.builder()
            .label("theme")
            .build()));
    }

    @Test
    void deleteTagSoftDeletesLabelAndReturnsTimeline() {
        FakeSessionTagMapper tagMapper = new FakeSessionTagMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), tagMapper);

        ReadingSessionTimelineResponse response = business.deleteTag(77L, 55L);

        assertThat(tagMapper.deletedSessionId).isEqualTo(77L);
        assertThat(tagMapper.deletedTagId).isEqualTo(55L);
        assertThat(tagMapper.deletedUserId).isEqualTo(1L);
        assertThat(response.getTags()).isEmpty();
    }

    @Test
    void createInsightStoresReviewTakeawayAndReturnsTimeline() {
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), insightMapper, new FakeSessionTagMapper());

        ReadingSessionTimelineResponse response = business.createInsight(77L, CreateSessionInsightRequest.builder()
            .title("  Ritual before politics  ")
            .content("  Power is introduced through ceremony before exposition.  ")
            .evidence("  Gom Jabbar scene  ")
            .authorName("  Reader One  ")
            .visibility("public")
            .reviewedOn("2026-07-03")
            .build());

        assertThat(insightMapper.inserted.getSessionId()).isEqualTo(77L);
        assertThat(insightMapper.inserted.getUserId()).isEqualTo(1L);
        assertThat(insightMapper.inserted.getInsightType()).isEqualTo("takeaway");
        assertThat(insightMapper.inserted.getTitle()).isEqualTo("Ritual before politics");
        assertThat(insightMapper.inserted.getContent()).isEqualTo("Power is introduced through ceremony before exposition.");
        assertThat(insightMapper.inserted.getEvidence()).isEqualTo("Gom Jabbar scene");
        assertThat(insightMapper.inserted.getAuthorName()).isEqualTo("Reader One");
        assertThat(insightMapper.inserted.getVisibility()).isEqualTo("PUBLIC");
        assertThat(insightMapper.inserted.getReviewedOn().toString()).isEqualTo("2026-07-03");
        assertThat(insightMapper.inserted.getInsightOrder()).isEqualTo(2);
        assertThat(insightMapper.inserted.isTestData()).isTrue();
        assertThat(response.getInsights()).extracting("content").contains("Power is introduced through ceremony before exposition.");
    }

    @Test
    void saveQuestionAnswerCreatesThenUpdatesOnePrivateLinkedInsight() {
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        FakeQuestionMapper questionMapper = new FakeQuestionMapper();
        ReadingSessionBusiness business = business(
            new FakeReadingSessionMapper(),
            new FakeSessionWindowMapper(),
            new FakeSessionHighlightMapper(),
            insightMapper,
            new FakeSessionSearchMapper(),
            new FakeSessionTagMapper(),
            new FakeMessageMapper(),
            questionMapper
        );

        ReadingSessionTimelineResponse created = business.saveQuestionAnswer(
            42L,
            SaveQuestionAnswerRequest.builder().content(" First answer ").build()
        );
        ReadingSessionTimelineResponse updated = business.saveQuestionAnswer(
            42L,
            SaveQuestionAnswerRequest.builder().content("Updated answer").build()
        );

        assertThat(insightMapper.inserted.getQuestionId()).isEqualTo(42L);
        assertThat(insightMapper.inserted.getInsightType()).isEqualTo("question_answer");
        assertThat(insightMapper.inserted.getVisibility()).isEqualTo("PRIVATE");
        assertThat(created.getStats().getAnsweredQuestionCount()).isEqualTo(1);
        assertThat(updated.getInsights()).filteredOn(
            (insight) -> "question_answer".equals(insight.getInsightType())
        ).singleElement()
            .satisfies((insight) -> {
                assertThat(insight.getQuestionId()).isEqualTo(42L);
                assertThat(insight.getContent()).isEqualTo("Updated answer");
            });
    }

    @Test
    void createInsightRejectsImpossibleReviewDate() {
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), new FakeSessionInsightMapper(), new FakeSessionTagMapper());

        assertBadRequest("reviewedOn must be a valid date", () -> business.createInsight(77L, CreateSessionInsightRequest.builder()
            .content("Review body")
            .reviewedOn("2026-02-31")
            .build()));
    }

    @Test
    void updateInsightStoresEditedReviewMetadataAndReturnsTimeline() {
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), insightMapper, new FakeSessionTagMapper());

        ReadingSessionTimelineResponse response = business.updateInsight(77L, 66L, UpdateSessionInsightRequest.builder()
            .title("  Revised ritual note  ")
            .content("  Revised review body.  ")
            .evidence("  Chapter 3  ")
            .authorName("  Revised Author  ")
            .visibility("PRIVATE")
            .reviewedOn("2026-07-04")
            .build());

        assertThat(insightMapper.updatedSessionId).isEqualTo(77L);
        assertThat(insightMapper.updatedInsightId).isEqualTo(66L);
        assertThat(insightMapper.updatedUserId).isEqualTo(1L);
        assertThat(response.getInsights()).singleElement()
            .satisfies((insight) -> {
                assertThat(insight.getTitle()).isEqualTo("Revised ritual note");
                assertThat(insight.getContent()).isEqualTo("Revised review body.");
                assertThat(insight.getEvidence()).isEqualTo("Chapter 3");
                assertThat(insight.getAuthorName()).isEqualTo("Revised Author");
                assertThat(insight.getVisibility()).isEqualTo("PRIVATE");
                assertThat(insight.getReviewedOn()).isEqualTo("2026-07-04");
            });
    }

    @Test
    void updateInsightRejectsImpossibleReviewDate() {
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), new FakeSessionInsightMapper(), new FakeSessionTagMapper());

        assertBadRequest("reviewedOn must be a valid date", () -> business.updateInsight(77L, 66L, UpdateSessionInsightRequest.builder()
            .content("Review body")
            .reviewedOn("2026-02-31")
            .build()));
    }

    @Test
    void createInsightRejectsZeroRowInsert() {
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        insightMapper.insertRows = 0;
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), insightMapper, new FakeSessionTagMapper());

        assertServerError("Session insight could not be saved", () -> business.createInsight(77L, CreateSessionInsightRequest.builder()
            .content("Power is introduced through ceremony before exposition.")
            .build()));
    }

    @Test
    void deleteInsightSoftDeletesReviewTakeawayAndReturnsTimeline() {
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), new FakeSessionHighlightMapper(), insightMapper, new FakeSessionTagMapper());

        ReadingSessionTimelineResponse response = business.deleteInsight(77L, 66L);

        assertThat(insightMapper.deletedSessionId).isEqualTo(77L);
        assertThat(insightMapper.deletedInsightId).isEqualTo(66L);
        assertThat(insightMapper.deletedUserId).isEqualTo(1L);
        assertThat(response.getInsights()).isEmpty();
    }

    @Test
    void childRecordMutationsReturnNotFoundWhenRowsAreMissing() {
        FakeSessionHighlightMapper highlightMapper = new FakeSessionHighlightMapper();
        highlightMapper.updatedRows = 0;
        highlightMapper.deletedRows = 0;
        FakeSessionTagMapper tagMapper = new FakeSessionTagMapper();
        tagMapper.deletedRows = 0;
        FakeSessionInsightMapper insightMapper = new FakeSessionInsightMapper();
        insightMapper.deletedRows = 0;
        insightMapper.updatedRows = 0;
        ReadingSessionBusiness business = business(new FakeReadingSessionMapper(), highlightMapper, insightMapper, tagMapper);

        assertNotFound("Session highlight not found", () -> business.updateHighlight(77L, 999L, UpdateSessionHighlightRequest.builder()
            .quoteText("Missing")
            .build()));
        assertNotFound("Session highlight not found", () -> business.deleteHighlight(77L, 999L));
        assertNotFound("Session tag not found", () -> business.deleteTag(77L, 999L));
        assertNotFound("Session insight not found", () -> business.updateInsight(77L, 999L, UpdateSessionInsightRequest.builder()
            .content("Missing")
            .build()));
        assertNotFound("Session insight not found", () -> business.deleteInsight(77L, 999L));
    }

    @Test
    void childRecordWritesReturnNotFoundWhenParentSessionIsMissing() {
        FakeReadingSessionMapper mapper = new FakeReadingSessionMapper();
        mapper.sessionMissing = true;
        ReadingSessionBusiness business = business(mapper, new FakeSessionHighlightMapper());

        assertNotFound("Reading session not found", () -> business.createHighlight(404L, CreateSessionHighlightRequest.builder()
            .quoteText("Missing parent")
            .build()));
        assertNotFound("Reading session not found", () -> business.updateHighlight(404L, 100L, UpdateSessionHighlightRequest.builder()
            .quoteText("Missing parent")
            .build()));
        assertNotFound("Reading session not found", () -> business.deleteHighlight(404L, 100L));
        assertNotFound("Reading session not found", () -> business.createTag(404L, CreateSessionTagRequest.builder()
            .label("missing")
            .build()));
        assertNotFound("Reading session not found", () -> business.deleteTag(404L, 55L));
        assertNotFound("Reading session not found", () -> business.createInsight(404L, CreateSessionInsightRequest.builder()
            .content("Missing parent")
            .build()));
        assertNotFound("Reading session not found", () -> business.updateInsight(404L, 66L, UpdateSessionInsightRequest.builder()
            .content("Missing parent")
            .build()));
        assertNotFound("Reading session not found", () -> business.deleteInsight(404L, 66L));
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        FakeSessionHighlightMapper sessionHighlightMapper
    ) {
        return business(readingSessionMapper, sessionHighlightMapper, new FakeSessionInsightMapper(), new FakeSessionTagMapper());
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        FakeSessionHighlightMapper sessionHighlightMapper,
        FakeSessionTagMapper sessionTagMapper
    ) {
        return business(readingSessionMapper, sessionHighlightMapper, new FakeSessionInsightMapper(), sessionTagMapper);
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        FakeSessionHighlightMapper sessionHighlightMapper,
        FakeSessionInsightMapper sessionInsightMapper,
        FakeSessionTagMapper sessionTagMapper
    ) {
        return business(readingSessionMapper, sessionHighlightMapper, sessionInsightMapper, new FakeReviewCommentMapper(), sessionTagMapper);
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        FakeSessionHighlightMapper sessionHighlightMapper,
        FakeSessionInsightMapper sessionInsightMapper,
        FakeReviewCommentMapper reviewCommentMapper,
        FakeSessionTagMapper sessionTagMapper
    ) {
        return business(readingSessionMapper, sessionHighlightMapper, sessionInsightMapper, reviewCommentMapper, new FakeSessionSearchMapper(), sessionTagMapper);
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        FakeSessionHighlightMapper sessionHighlightMapper,
        FakeSessionInsightMapper sessionInsightMapper,
        FakeSessionSearchMapper sessionSearchMapper,
        FakeSessionTagMapper sessionTagMapper
    ) {
        return business(readingSessionMapper, sessionHighlightMapper, sessionInsightMapper, new FakeReviewCommentMapper(), sessionSearchMapper, sessionTagMapper);
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        FakeSessionHighlightMapper sessionHighlightMapper,
        FakeSessionInsightMapper sessionInsightMapper,
        FakeReviewCommentMapper reviewCommentMapper,
        FakeSessionSearchMapper sessionSearchMapper,
        FakeSessionTagMapper sessionTagMapper
    ) {
        return new ReadingSessionBusiness(
            readingSessionMapper,
            new FakeSessionWindowMapper(),
            sessionHighlightMapper,
            sessionInsightMapper,
            reviewCommentMapper,
            sessionSearchMapper,
            sessionTagMapper,
            new FakeMessageMapper(),
            new FakeQuestionMapper()
        );
    }

    private ReadingSessionBusiness business(
        FakeReadingSessionMapper readingSessionMapper,
        SessionWindowMapper sessionWindowMapper,
        SessionHighlightMapper sessionHighlightMapper,
        FakeSessionInsightMapper sessionInsightMapper,
        FakeSessionSearchMapper sessionSearchMapper,
        FakeSessionTagMapper sessionTagMapper,
        MessageMapper messageMapper,
        QuestionMapper questionMapper
    ) {
        return new ReadingSessionBusiness(
            readingSessionMapper,
            sessionWindowMapper,
            sessionHighlightMapper,
            sessionInsightMapper,
            new FakeReviewCommentMapper(),
            sessionSearchMapper,
            sessionTagMapper,
            messageMapper,
            questionMapper
        );
    }

    private static class FakeReadingSessionMapper implements ReadingSessionMapper {
        private ReadingSessionRecord inserted;
        private Long deletedSessionId;
        private Long deletedUserId;
        private Long updatedTitleSessionId;
        private Long updatedTitleUserId;
        private String updatedTitle;
        private int insertRows = 1;
        private int updatedRows = 1;
        private int activeBookCount = 1;
        private boolean owningBookTestData;
        private boolean sessionMissing;

        @Override
        public int countActiveBookById(Long bookId, Long userId) {
            return activeBookCount;
        }

        @Override
        public ReadingSessionRecord findFirstByBookIdAndUserId(Long bookId, Long userId) {
            return null;
        }

        @Override
        public boolean findBookTestData(Long bookId, Long userId) {
            return owningBookTestData;
        }

        @Override
        public int insert(ReadingSessionRecord record) {
            this.inserted = record;
            record.setId(77L);
            return insertRows;
        }

        @Override
        public ReadingSessionRecord findLatestByUserId(Long userId) {
            if (sessionMissing) {
                return null;
            }

            return sessionRecord(userId);
        }

        @Override
        public List<ReadingSessionRecord> findSummariesByUserId(Long userId) {
            if (deletedSessionId != null) {
                return List.of();
            }

            return List.of(ReadingSessionRecord.builder()
                .id(77L)
                .userId(userId)
                .bookId(7L)
                .bookTitle("Seed Book")
                .bookAuthor("Seed Author")
                .title(updatedTitle == null ? "My Session" : updatedTitle)
                .windowCount(1)
                .questionCount(1)
                .answeredQuestionCount(1)
                .highlightCount(1)
                .messageCount(2)
                .build());
        }

        @Override
        public ReadingSessionRecord findByIdAndUserId(Long sessionId, Long userId) {
            if (sessionMissing) {
                return null;
            }

            return sessionRecord(userId);
        }


        @Override
        public int softDelete(Long sessionId, Long userId) {
            this.deletedSessionId = sessionId;
            this.deletedUserId = userId;
            return updatedRows;
        }

        @Override
        public int updateTitle(Long sessionId, Long userId, String title) {
            this.updatedTitleSessionId = sessionId;
            this.updatedTitleUserId = userId;
            this.updatedTitle = title;
            return updatedRows;
        }


        private ReadingSessionRecord sessionRecord(Long userId) {
            return ReadingSessionRecord.builder()
                .id(77L)
                .userId(userId)
                .bookId(7L)
                .bookTitle("Seed Book")
                .bookAuthor("Seed Author")
                .title(updatedTitle == null ? "My Session" : updatedTitle)
                .build();
        }
    }

    private static class FakeSessionWindowMapper implements SessionWindowMapper {
        @Override
        public int updateContextSnapshot(Long windowId, String contextSnapshot) {
            return 1;
        }

        @Override
        public int updateReflectionSummary(Long insightId, String summary, String sourceHash, String model, String tokenUsage) {
            return 1;
        }
        @Override
        public int insert(SessionWindowRecord record) {
            return 1;
        }

        @Override
        public SessionWindowRecord findById(Long id) {
            return SessionWindowRecord.builder()
                .id(id)
                .sessionId(77L)
                .windowType("question")
                .title("Question")
                .position(1)
                .status("open")
                .build();
        }

        @Override
        public SessionWindowContext findContextById(Long id) {
            return null;
        }

        @Override
        public SessionWindowRecord findActiveDebateBySourceQuestion(Long questionId, Long userId) {
            return null;
        }

        @Override
        public int updateTitle(Long windowId, String title) {
            return 1;
        }

        @Override
        public int softDelete(Long windowId) {
            return 1;
        }

        @Override
        public int countActiveBySessionId(Long sessionId) {
            return findBySessionId(sessionId).size();
        }

        @Override
        public int countActiveSessionById(Long sessionId, Long userId) {
            return 1;
        }

        @Override
        public int selectNextPosition(Long sessionId) {
            return 1;
        }

        @Override
        public List<SessionWindowRecord> findBySessionId(Long sessionId) {
            return List.of(SessionWindowRecord.builder()
                .id(88L)
                .sessionId(sessionId)
                .windowType("question")
                .title("Question")
                .position(1)
                .status("open")
                .build());
        }
    }

    private static class EmptySessionWindowMapper extends FakeSessionWindowMapper {
        @Override
        public List<SessionWindowRecord> findBySessionId(Long sessionId) {
            return List.of();
        }
    }

    private static class FakeSessionHighlightMapper implements SessionHighlightMapper {
        private SessionHighlightRecord inserted;
        private Long updatedSessionId;
        private Long updatedHighlightId;
        private Long updatedUserId;
        private Integer updatedPageNumber;
        private String updatedLocationLabel;
        private String updatedQuoteText;
        private String updatedNote;
        private Long deletedSessionId;
        private Long deletedHighlightId;
        private Long deletedUserId;
        private int insertRows = 1;
        private int updatedRows = 1;
        private int deletedRows = 1;

        @Override
        public int insert(SessionHighlightRecord record) {
            if (insertRows <= 0) {
                return insertRows;
            }
            this.inserted = record;
            record.setId(101L);
            return insertRows;
        }

        @Override
        public int selectNextOrder(Long sessionId) {
            return 2;
        }

        @Override
        public List<SessionHighlightRecord> findBySessionId(Long sessionId) {
            if (deletedHighlightId != null) {
                return List.of();
            }
            if (updatedHighlightId != null) {
                return List.of(SessionHighlightRecord.builder()
                    .id(updatedHighlightId)
                    .sessionId(sessionId)
                    .bookId(7L)
                    .pageNumber(updatedPageNumber)
                    .locationLabel(updatedLocationLabel)
                    .quoteText(updatedQuoteText)
                    .note(updatedNote)
                    .highlightOrder(1)
                    .build());
            }

            if (inserted != null) {
                return List.of(
                    SessionHighlightRecord.builder()
                        .id(100L)
                        .sessionId(sessionId)
                        .bookId(7L)
                        .pageNumber(12)
                        .locationLabel("Chapter 1")
                        .quoteText("Saved highlight")
                        .note("Existing note")
                        .highlightOrder(1)
                        .build(),
                    inserted
                );
            }

            return List.of(SessionHighlightRecord.builder()
                .id(100L)
                .sessionId(sessionId)
                .bookId(7L)
                .pageNumber(12)
                .locationLabel("Chapter 1")
                .quoteText("Saved highlight")
                .note("Existing note")
                .highlightOrder(1)
                .build());
        }

        @Override
        public List<SessionHighlightRecord> findBoundedOwnedBySession(
            Long sessionId,
            Long userId,
            int limit
        ) {
            List<SessionHighlightRecord> records = findBySessionId(sessionId);
            return records.subList(0, Math.min(records.size(), Math.max(0, limit)));
        }

        @Override
        public int update(
            Long sessionId,
            Long highlightId,
            Long userId,
            Integer pageNumber,
            String locationLabel,
            String quoteText,
            String note
        ) {
            this.updatedSessionId = sessionId;
            this.updatedHighlightId = highlightId;
            this.updatedUserId = userId;
            this.updatedPageNumber = pageNumber;
            this.updatedLocationLabel = locationLabel;
            this.updatedQuoteText = quoteText;
            this.updatedNote = note;
            return updatedRows;
        }

        @Override
        public int softDelete(Long sessionId, Long highlightId, Long userId) {
            this.deletedSessionId = sessionId;
            this.deletedHighlightId = highlightId;
            this.deletedUserId = userId;
            return deletedRows;
        }
    }

    private static class EmptySessionHighlightMapper extends FakeSessionHighlightMapper {
        @Override
        public List<SessionHighlightRecord> findBySessionId(Long sessionId) {
            return List.of();
        }
    }

    private static class FakeSessionTagMapper implements SessionTagMapper {
        private SessionTagRecord inserted;
        private Long deletedSessionId;
        private Long deletedTagId;
        private Long deletedUserId;
        private int insertRows = 1;
        private int deletedRows = 1;

        @Override
        public int insert(SessionTagRecord record) {
            if (insertRows <= 0) {
                return insertRows;
            }
            this.inserted = record;
            record.setId(56L);
            return insertRows;
        }

        @Override
        public List<SessionTagRecord> findBySessionId(Long sessionId, Long userId) {
            if (deletedTagId != null) {
                return List.of();
            }
            if (inserted != null) {
                return List.of(
                    SessionTagRecord.builder()
                        .id(55L)
                        .sessionId(sessionId)
                        .userId(userId)
                        .label("politics")
                        .build(),
                    inserted
                );
            }

            return List.of(SessionTagRecord.builder()
                .id(55L)
                .sessionId(sessionId)
                .userId(userId)
                .label("politics")
                .build());
        }

        @Override
        public List<SessionTagRecord> findBySessionIds(List<Long> sessionIds, Long userId) {
            return sessionIds.stream()
                .flatMap((sessionId) -> findBySessionId(sessionId, userId).stream())
                .toList();
        }

        @Override
        public int softDelete(Long sessionId, Long tagId, Long userId) {
            this.deletedSessionId = sessionId;
            this.deletedTagId = tagId;
            this.deletedUserId = userId;
            return deletedRows;
        }
    }

    private static class FakeSessionInsightMapper implements SessionInsightMapper {
        private SessionInsightRecord inserted;
        private Long updatedSessionId;
        private Long updatedInsightId;
        private Long updatedUserId;
        private String updatedInsightType;
        private String updatedTitle;
        private String updatedContent;
        private String updatedEvidence;
        private String updatedAuthorName;
        private String updatedVisibility;
        private java.time.LocalDate updatedReviewedOn;
        private Long deletedSessionId;
        private Long deletedInsightId;
        private Long deletedUserId;
        private int insertRows = 1;
        private int updatedRows = 1;
        private int deletedRows = 1;
        private int publicReviewLimit;

        @Override
        public int insert(SessionInsightRecord record) {
            if (insertRows <= 0) {
                return insertRows;
            }
            this.inserted = record;
            record.setId(67L);
            return insertRows;
        }

        @Override
        public int selectNextOrder(Long sessionId) {
            return 2;
        }

        @Override
        public List<SessionInsightRecord> findBySessionId(Long sessionId, Long userId) {
            if (deletedInsightId != null) {
                return List.of();
            }
            if (updatedInsightId != null) {
                return List.of(SessionInsightRecord.builder()
                    .id(updatedInsightId)
                    .sessionId(sessionId)
                    .userId(userId)
                    .insightType(updatedInsightType)
                    .title(updatedTitle)
                    .content(updatedContent)
                    .evidence(updatedEvidence)
                    .authorName(updatedAuthorName)
                    .visibility(updatedVisibility)
                    .reviewedOn(updatedReviewedOn)
                    .insightOrder(1)
                    .build());
            }
            if (inserted != null) {
                return List.of(
                    SessionInsightRecord.builder()
                        .id(66L)
                        .sessionId(sessionId)
                        .userId(userId)
                        .insightType("takeaway")
                        .title("Ritual and power")
                        .content("Power is staged before it is explained.")
                        .evidence("Opening ceremony")
                        .authorName("Seed Reader")
                        .visibility("PRIVATE")
                        .reviewedOn(java.time.LocalDate.parse("2026-07-01"))
                        .insightOrder(1)
                        .build(),
                    inserted
                );
            }

            return List.of(SessionInsightRecord.builder()
                .id(66L)
                .sessionId(sessionId)
                .userId(userId)
                .insightType("takeaway")
                .title("Ritual and power")
                .content("Power is staged before it is explained.")
                .evidence("Opening ceremony")
                .authorName("Seed Reader")
                .visibility("PRIVATE")
                .reviewedOn(java.time.LocalDate.parse("2026-07-01"))
                .insightOrder(1)
                .build());
        }

        @Override
        public SessionInsightRecord findActiveByQuestionId(Long questionId, Long userId) {
            return inserted != null && questionId.equals(inserted.getQuestionId()) ? inserted : null;
        }

        @Override
        public SessionInsightRecord findActiveById(Long sessionId, Long insightId, Long userId) {
            return findBySessionId(sessionId, userId).stream()
                .filter((record) -> insightId.equals(record.getId()))
                .findFirst()
                .orElse(null);
        }

        @Override
        public List<com.margins.session.model.PublicReviewRecord> findPublicReviews(int limit) {
            this.publicReviewLimit = limit;
            return List.of(com.margins.session.model.PublicReviewRecord.builder()
                .insightId(166L)
                .sessionId(77L)
                .bookId(7L)
                .bookTitle("Seed Book")
                .bookAuthor("Seed Author")
                .sessionTitle("My Session")
                .title("Public ritual note")
                .content("Public reading review.")
                .evidence("Opening ceremony")
                .authorName("Public Reader")
                .reviewedOn(java.time.LocalDate.parse("2026-07-03"))
                .createdAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                .updatedAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                .build());
        }

        @Override
        public int update(
            Long sessionId,
            Long insightId,
            Long userId,
            String insightType,
            String title,
            String content,
            String evidence,
            String authorName,
            String visibility,
            java.time.LocalDate reviewedOn
        ) {
            this.updatedSessionId = sessionId;
            this.updatedInsightId = insightId;
            this.updatedUserId = userId;
            this.updatedInsightType = insightType;
            this.updatedTitle = title;
            this.updatedContent = content;
            this.updatedEvidence = evidence;
            this.updatedAuthorName = authorName;
            this.updatedVisibility = visibility;
            this.updatedReviewedOn = reviewedOn;
            return updatedRows;
        }

        @Override
        public int updateQuestionAnswer(Long questionId, Long userId, String content) {
            if (inserted == null || !questionId.equals(inserted.getQuestionId())) {
                return 0;
            }
            inserted.setContent(content);
            return updatedRows;
        }

        @Override
        public int softDelete(Long sessionId, Long insightId, Long userId) {
            this.deletedSessionId = sessionId;
            this.deletedInsightId = insightId;
            this.deletedUserId = userId;
            return deletedRows;
        }
    }

    private static class FakeReviewCommentMapper implements ReviewCommentMapper {
        private ReviewCommentRecord inserted;
        private int publicReviewCount = 1;
        private int activeParentCount = 1;
        private Long deletedInsightId;
        private Long deletedCommentId;
        private Long deletedUserId;
        private Long updatedInsightId;
        private Long updatedCommentId;
        private Long updatedUserId;
        private String updatedContent;
        private int deletedRows = 1;
        private int updatedRows = 1;

        @Override
        public int insert(ReviewCommentRecord record) {
            this.inserted = record;
            record.setId(301L);
            return 1;
        }

        @Override
        public int countPublicReview(Long insightId) {
            return publicReviewCount;
        }

        @Override
        public int countActiveParent(Long insightId, Long parentCommentId) {
            return activeParentCount;
        }

        @Override
        public List<ReviewCommentRecord> findByInsightId(Long insightId) {
            if (deletedCommentId != null) {
                return List.of();
            }
            if (updatedCommentId != null) {
                return List.of(ReviewCommentRecord.builder()
                    .id(updatedCommentId)
                    .insightId(insightId)
                    .userId(updatedUserId)
                    .authorName("Test Reader")
                    .content(updatedContent)
                    .createdAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                    .updatedAt(java.time.LocalDateTime.parse("2026-07-04T10:15:30"))
                    .build());
            }
            if (inserted != null) {
                return List.of(
                    ReviewCommentRecord.builder()
                        .id(300L)
                        .insightId(insightId)
                        .userId(1L)
                        .authorName("Seed Reader")
                        .content("Existing comment")
                        .createdAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                        .updatedAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                        .build(),
                    ReviewCommentRecord.builder()
                        .id(inserted.getId())
                        .insightId(inserted.getInsightId())
                        .userId(inserted.getUserId())
                        .parentCommentId(inserted.getParentCommentId())
                        .authorName("Test Reader")
                        .content(inserted.getContent())
                        .createdAt(java.time.LocalDateTime.parse("2026-07-04T10:15:30"))
                        .updatedAt(java.time.LocalDateTime.parse("2026-07-04T10:15:30"))
                        .build()
                );
            }

            return List.of(ReviewCommentRecord.builder()
                .id(300L)
                .insightId(insightId)
                .userId(1L)
                .authorName("Seed Reader")
                .content("Existing comment")
                .createdAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                .updatedAt(java.time.LocalDateTime.parse("2026-07-03T10:15:30"))
                .build());
        }

        @Override
        public int updateContent(Long insightId, Long commentId, Long userId, String content) {
            this.updatedInsightId = insightId;
            this.updatedCommentId = commentId;
            this.updatedUserId = userId;
            this.updatedContent = content;
            return updatedRows;
        }

        @Override
        public int softDelete(Long insightId, Long commentId, Long userId) {
            this.deletedInsightId = insightId;
            this.deletedCommentId = commentId;
            this.deletedUserId = userId;
            return deletedRows;
        }
    }

    private static class FakeSessionSearchMapper implements SessionSearchMapper {
        private String query;
        private int limit;

        @Override
        public List<SessionSearchResultRecord> search(Long userId, String query, int limit) {
            this.query = query;
            this.limit = limit;
            return List.of(SessionSearchResultRecord.builder()
                .sessionId(77L)
                .sourceId(66L)
                .resultType("insight")
                .bookTitle("Seed Book")
                .sessionTitle("My Session")
                .snippet("Power becomes visible through ceremony.")
                .build());
        }
    }

    private static class FakeMessageMapper implements MessageMapper {
        @Override
        public int insert(MessageRecord record) {
            return 1;
        }

        @Override
        public int selectNextOrder(Long sessionId, Long windowId) {
            return 1;
        }

        @Override
        public List<MessageRecord> findBySessionId(Long sessionId) {
            return List.of(MessageRecord.builder()
                .id(99L)
                .sessionId(sessionId)
                .windowId(88L)
                .role("user")
                .content("Saved reflection")
                .questionId(42L)
                .messageOrder(1)
                .streamingStatus("complete")
                .build());
        }

        @Override
        public List<MessageRecord> findRecentByWindowBefore(Long windowId, Long beforeMessageId, int limit) {
            return findBySessionId(77L).stream()
                .filter(message -> windowId.equals(message.getWindowId()))
                .limit(limit)
                .toList();
        }

        @Override
        public List<MessageRecord> findSummaryCandidates(Long windowId, Long afterMessageId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public MessageRecord findEditableById(Long messageId, Long userId) {
            return null;
        }

        @Override
        public int updateContent(Long messageId, Long userId, String content) {
            return 1;
        }

        @Override
        public int invalidateConversationSummary(Long windowId, Long messageId) {
            return 1;
        }

        @Override
        public int softDelete(Long messageId, Long userId) {
            return 1;
        }
    }

    private static class EmptyMessageMapper extends FakeMessageMapper {
        @Override
        public List<MessageRecord> findBySessionId(Long sessionId) {
            return List.of();
        }
    }

    private static class FakeQuestionMapper implements QuestionMapper {
        @Override
        public int insert(QuestionRecord record) {
            return 1;
        }

        @Override
        public List<QuestionRecord> findBySessionId(Long sessionId) {
            return List.of(QuestionRecord.builder()
                .id(42L)
                .sessionId(sessionId)
                .windowId(88L)
                .questionText("What changed?")
                .questionType("reflection")
                .status("active")
                .aiModel("placeholder")
                .build());
        }

        @Override
        public List<QuestionRecord> findByWindowId(Long windowId) {
            return List.of();
        }

        @Override
        public QuestionRecord findActiveById(Long questionId, Long userId) {
            return findBySessionId(77L).stream()
                .filter((question) -> question.getId().equals(questionId))
                .peek((question) -> question.setUserId(userId))
                .findFirst()
                .orElse(null);
        }

        @Override
        public int countActiveUserAnswers(Long questionId) {
            return 0;
        }

        @Override
        public int softDelete(Long questionId, Long userId) {
            return 1;
        }
    }

    private static class EmptyQuestionMapper extends FakeQuestionMapper {
        @Override
        public List<QuestionRecord> findBySessionId(Long sessionId) {
            return List.of();
        }
    }
}
