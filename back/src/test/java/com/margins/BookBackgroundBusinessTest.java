package com.margins;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.margins.book.business.BookBackgroundBusiness;
import com.margins.book.dto.UpdateBookBackgroundRequest;
import com.margins.book.mapper.BookBackgroundMapper;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class BookBackgroundBusinessTest {
    private final BookMapper books = mock(BookMapper.class);
    private final BookBackgroundMapper backgrounds = mock(BookBackgroundMapper.class);
    private final BookBackgroundBusiness business = new BookBackgroundBusiness(books, backgrounds);

    @Test void initialReadDoesNotWriteAndMissingBookUsesNotFound() {
        when(books.findByIdForUser(7L, 1L)).thenReturn(BookRecord.builder().id(7L).userId(1L).build());
        assertThat(business.find(7L).getRevision()).isZero();
        assertThat(business.find(7L).getSummary()).isNull();
        verifyNoInteractions(backgrounds);
        assertThatThrownBy(() -> business.find(99L)).isInstanceOf(ApiException.class)
            .extracting("code").isEqualTo(ApiErrorCode.COMMON_NOT_FOUND);
    }

    @Test void savesTrimmedSummaryAndUsesOwnerRevisionPredicate() {
        BookRecord book = BookRecord.builder().id(7L).userId(1L).backgroundRevision(4).build();
        when(books.findByIdForUser(7L, 1L)).thenReturn(book);
        when(backgrounds.update(7L, 1L, "reader background", 4)).thenAnswer(call -> {
            book.setBackgroundSummary("reader background"); book.setBackgroundRevision(5); return 1;
        });
        assertThat(business.update(7L, request("  reader background  ", 4)).getRevision()).isEqualTo(5);
        verify(backgrounds).update(7L, 1L, "reader background", 4);
    }

    @Test void staleWriteFailsWithoutRetryOrDeletingDraft() {
        when(books.findByIdForUser(7L, 1L)).thenReturn(BookRecord.builder().id(7L).backgroundRevision(5).build());
        assertThatThrownBy(() -> business.update(7L, request("draft", 4)))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo(ApiErrorCode.COMMON_CONFLICT);
        verify(backgrounds, times(1)).update(7L, 1L, "draft", 4);
    }

    @Test void invalidOrForeignWritesNeverTouchPersistence() {
        when(books.findByIdForUser(7L, 1L)).thenReturn(BookRecord.builder().id(7L).build());
        for (var request : java.util.List.of(request("  ", 0), request("a".repeat(10001), 0), request("x", -1))) {
            assertThatThrownBy(() -> business.update(7L, request)).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo(ApiErrorCode.COMMON_BAD_REQUEST);
        }
        assertThatThrownBy(() -> business.update(99L, request("private", 0))).isInstanceOf(ApiException.class)
            .extracting("code").isEqualTo(ApiErrorCode.COMMON_NOT_FOUND);
        verifyNoInteractions(backgrounds);
    }

    private UpdateBookBackgroundRequest request(String summary, int revision) {
        return UpdateBookBackgroundRequest.builder().summary(summary).expectedRevision(revision).build();
    }
}
