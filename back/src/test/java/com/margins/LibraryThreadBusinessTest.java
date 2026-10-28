package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.margins.book.business.LibraryThreadBusiness;
import com.margins.book.dto.LibraryThreadResponse;
import com.margins.book.mapper.LibraryThreadMapper;
import com.margins.book.model.LibraryActivityRecord;
import com.margins.book.model.LibraryCountRecord;
import com.margins.book.model.LibraryRevisionSummaryRecord;
import com.margins.book.model.LibraryThreadRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class LibraryThreadBusinessTest {

    @Test
    void returnsBoundedThreadsWithExactLocatorsAndThreeBodyFreeRevisionSummaries() {
        LibraryThreadMapper mapper = mock(LibraryThreadMapper.class);
        LibraryThreadBusiness business = new LibraryThreadBusiness(mapper);
        List<LibraryThreadRecord> rows = List.of(
            thread(11L),
            thread(12L).toBuilder()
                .reflectionId(102L)
                .currentRevisionId(202L)
                .currentRevisionNumber(2)
                .interviewId(302L)
                .answeredCount(3)
                .guideId(402L)
                .runId(502L)
                .runStatus("ACTIVE")
                .build(),
            thread(13L)
        );
        when(mapper.findThreads(1L, "reading", null, "recent", 3, 0)).thenReturn(rows);
        when(mapper.findRecentRevisions(1L, List.of(11L, 12L))).thenReturn(List.of(
            revision(12L, 903L, 3),
            revision(12L, 902L, 2),
            revision(12L, 901L, 1)
        ));
        when(mapper.countByShelf(1L)).thenReturn(List.of(
            LibraryCountRecord.builder().category("reading").total(2L).build(),
            LibraryCountRecord.builder().category("read").total(1L).build()
        ));
        when(mapper.countByStage(1L)).thenReturn(List.of(
            LibraryCountRecord.builder().category("REFLECT").total(1L).build(),
            LibraryCountRecord.builder().category("DISCUSS").total(2L).build()
        ));
        when(mapper.findRecentActivity(1L, 30)).thenReturn(List.of(
            LibraryActivityRecord.builder()
                .bookId(12L)
                .bookTitle("Book 12")
                .bookAuthor("Reader")
                .revisionId(903L)
                .version(3)
                .revisionSource("USER_EDIT")
                .createdAt(LocalDateTime.of(2026, 9, 1, 12, 3))
                .build()
        ));

        LibraryThreadResponse response = business.findThreads(" READING ", null, null, null, 2);

        assertThat(response.getThreads()).hasSize(2);
        assertThat(response.getNextCursor()).isEqualTo("2");
        assertThat(response.getThreads().getFirst().getLoop().getStage()).isEqualTo("REFLECT");
        assertThat(response.getThreads().getFirst().getLoop().getContinueLocator().getHref())
            .isEqualTo("/book/11/reflection");
        assertThat(response.getThreads().get(1).getLoop().getStage()).isEqualTo("DISCUSS");
        assertThat(response.getThreads().get(1).getLoop().getContinueLocator().getHref())
            .isEqualTo("/book/12/reflection/discuss/502");
        assertThat(response.getThreads().get(1).getLoop().getAnsweredCount()).isEqualTo(3);
        assertThat(response.getThreads().get(1).getLoop().getTargetCount()).isEqualTo(5);
        assertThat(response.getThreads().get(1).getRecentRevisions())
            .extracting("version")
            .containsExactly(3, 2, 1);
        assertThat(response.getSummary().getShelfCounts())
            .containsEntry("all", 3L)
            .containsEntry("reading", 2L)
            .containsEntry("want_to_read", 0L);
        assertThat(response.getSummary().getStageCounts())
            .containsEntry("REFLECT", 1L)
            .containsEntry("DISCUSS", 2L)
            .containsEntry("REFINE", 0L);
        assertThat(response.getSummary().getRecentActivity()).singleElement().satisfies(activity -> {
            assertThat(activity.getBookId()).isEqualTo(12L);
            assertThat(activity.getVersion()).isEqualTo(3);
        });
        verify(mapper).findThreads(1L, "reading", null, "recent", 3, 0);
        verify(mapper).findRecentRevisions(1L, List.of(11L, 12L));
    }

    @Test
    void completedRunUsesRefineLocatorUntilARevisionIsCommitted() {
        LibraryThreadMapper mapper = mock(LibraryThreadMapper.class);
        LibraryThreadBusiness business = new LibraryThreadBusiness(mapper);
        LibraryThreadRecord row = thread(21L).toBuilder()
            .reflectionId(101L)
            .currentRevisionId(201L)
            .interviewId(301L)
            .guideId(401L)
            .runId(501L)
            .runStatus("COMPLETED")
            .build();
        when(mapper.findThreads(1L, null, null, "recent", 50 + 1, 0)).thenReturn(List.of(row));
        when(mapper.findRecentRevisions(1L, List.of(21L))).thenReturn(List.of());

        LibraryThreadResponse response = business.findThreads(null, null, null, null, null);

        assertThat(response.getThreads().getFirst().getLoop().getStage()).isEqualTo("REFINE");
        assertThat(response.getThreads().getFirst().getLoop().getContinueLocator().getHref())
            .isEqualTo("/book/21/reflection/refine/501");
    }

    @Test
    void savedReflectionWithoutAnInterviewContinuesAtInterview() {
        LibraryThreadMapper mapper = mock(LibraryThreadMapper.class);
        LibraryThreadBusiness business = new LibraryThreadBusiness(mapper);
        LibraryThreadRecord row = thread(31L).toBuilder()
            .reflectionId(101L)
            .currentRevisionId(201L)
            .currentRevisionNumber(1)
            .build();
        when(mapper.findThreads(1L, null, null, "recent", 51, 0)).thenReturn(List.of(row));
        when(mapper.findRecentRevisions(1L, List.of(31L))).thenReturn(List.of());

        LibraryThreadResponse response = business.findThreads(null, null, null, null, null);

        assertThat(response.getThreads().getFirst().getLoop().getStage()).isEqualTo("INTERVIEW");
        assertThat(response.getThreads().getFirst().getLoop().getContinueLocator().getHref())
            .isEqualTo("/book/31/reflection/interview");
    }

    @Test
    void omitsAggregateQueriesFromFollowUpPages() {
        LibraryThreadMapper mapper = mock(LibraryThreadMapper.class);
        LibraryThreadBusiness business = new LibraryThreadBusiness(mapper);
        when(mapper.findThreads(1L, null, null, "recent", 51, 50))
            .thenReturn(List.of(thread(51L)));
        when(mapper.findRecentRevisions(1L, List.of(51L))).thenReturn(List.of());

        LibraryThreadResponse response = business.findThreads(null, null, null, "50", null);

        assertThat(response.getThreads()).hasSize(1);
        assertThat(response.getSummary()).isNull();
        verify(mapper, never()).countByShelf(1L);
        verify(mapper, never()).countByStage(1L);
        verify(mapper, never()).findRecentActivity(1L, 30);
    }

    @Test
    void rejectsInvalidPagingAndShelfArgumentsBeforeQuerying() {
        LibraryThreadMapper mapper = mock(LibraryThreadMapper.class);
        LibraryThreadBusiness business = new LibraryThreadBusiness(mapper);

        assertThatThrownBy(() -> business.findThreads(null, null, null, "not-a-cursor", null))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> business.findThreads(null, null, null, null, 51))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> business.findThreads("archived", null, null, null, null))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> business.findThreads(null, null, "random", null, null))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> business.findThreads(null, "unknown", null, null, null))
            .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(mapper);
    }

    private LibraryThreadRecord thread(Long bookId) {
        return LibraryThreadRecord.builder()
            .bookId(bookId)
            .userId(1L)
            .title("Book " + bookId)
            .author("Reader")
            .readingStatus("reading")
            .bookUpdatedAt(LocalDateTime.of(2026, 9, 1, 12, 0))
            .build();
    }

    private LibraryRevisionSummaryRecord revision(Long bookId, Long revisionId, int version) {
        return LibraryRevisionSummaryRecord.builder()
            .bookId(bookId)
            .revisionId(revisionId)
            .version(version)
            .revisionSource("USER_EDIT")
            .createdAt(LocalDateTime.of(2026, 9, 1, 12, version))
            .build();
    }
}
