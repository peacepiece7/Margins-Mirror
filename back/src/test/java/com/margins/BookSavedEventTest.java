package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.margins.book.business.BookBusiness;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.dto.SaveBookRequest;
import com.margins.book.dto.SaveBookResponse;
import com.margins.book.event.BookSavedEvent;
import com.margins.book.event.BookSavedEventListener;
import com.margins.session.business.ReadingSessionBusiness;
import com.margins.book.service.BookService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class BookSavedEventTest {

    @Test
    void saveBookPublishesKnowledgeEventWithoutGeneratingSynchronously() {
        BookBusiness bookBusiness = mock(BookBusiness.class);
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        SaveBookResponse saved = SaveBookResponse.builder()
            .bookId(42L)
            .title("Saved Book")
            .build();
        when(bookBusiness.saveBook(any(SaveBookRequest.class))).thenReturn(saved);

        BookService service = new BookService(bookBusiness, knowledgeBusiness, eventPublisher);

        assertThat(service.saveBook(SaveBookRequest.builder().build()))
            .isSameAs(saved);

        verify(eventPublisher).publishEvent(new BookSavedEvent(42L, 1L));
        verifyNoInteractions(knowledgeBusiness);
    }

    @Test
    void saveBookDoesNotPublishKnowledgeEventWhenBookSaveFails() {
        BookBusiness bookBusiness = mock(BookBusiness.class);
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        when(bookBusiness.saveBook(any(SaveBookRequest.class)))
            .thenThrow(new ApiException(ApiErrorCode.BOOK_ALREADY_EXISTS));
        BookService service = new BookService(bookBusiness, knowledgeBusiness, eventPublisher);

        assertThatThrownBy(() -> service.saveBook(SaveBookRequest.builder().build()))
            .isInstanceOf(ApiException.class);

        verify(eventPublisher, never()).publishEvent(any());
        verifyNoInteractions(knowledgeBusiness);
    }

    @Test
    void saveBookRemainsSuccessfulWhenKnowledgeEventPublicationFails() {
        BookBusiness bookBusiness = mock(BookBusiness.class);
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        SaveBookResponse saved = SaveBookResponse.builder()
            .bookId(42L)
            .title("Saved Book")
            .build();
        when(bookBusiness.saveBook(any(SaveBookRequest.class))).thenReturn(saved);
        doThrow(new IllegalStateException("event infrastructure unavailable"))
            .when(eventPublisher)
            .publishEvent(any(BookSavedEvent.class));
        BookService service = new BookService(bookBusiness, knowledgeBusiness, eventPublisher);

        assertThat(service.saveBook(SaveBookRequest.builder().build()))
            .isSameAs(saved);

        verifyNoInteractions(knowledgeBusiness);
    }

    @Test
    void eventPublicationFailureLogContainsOnlySanitizedOperationalMetadata() {
        BookBusiness bookBusiness = mock(BookBusiness.class);
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        SaveBookResponse saved = SaveBookResponse.builder()
            .bookId(42L)
            .title("Saved Book")
            .build();
        when(bookBusiness.saveBook(any(SaveBookRequest.class))).thenReturn(saved);
        doThrow(new IllegalStateException("event infrastructure unavailable"))
            .when(eventPublisher)
            .publishEvent(any(BookSavedEvent.class));
        BookService service = new BookService(bookBusiness, knowledgeBusiness, eventPublisher);
        Logger logger = (Logger) LoggerFactory.getLogger(BookService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            service.saveBook(SaveBookRequest.builder().build());

            assertThat(appender.list)
                .anyMatch(event -> event.getFormattedMessage().contains("outcome=FAILURE"));
            assertThat(appender.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage())
                    .doesNotContain("bookId", "userId", "42", "1", "event infrastructure unavailable");
                if (event.getArgumentArray() != null) {
                    assertThat(event.getArgumentArray()).noneMatch(value -> value != null
                        && value.toString().contains("event infrastructure unavailable"));
                }
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void listenerPassesExplicitOwnerToKnowledgeGeneration() {
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ReadingSessionBusiness sessionBusiness = mock(ReadingSessionBusiness.class);
        BookSavedEventListener listener = new BookSavedEventListener(knowledgeBusiness, sessionBusiness);

        listener.handle(new BookSavedEvent(42L, 7L));

        verify(knowledgeBusiness).ensureForBook(42L, 7L);
    }

    @Test
    void listenerDoesNotPropagateKnowledgeFailureToSavedBookFlow() {
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ReadingSessionBusiness sessionBusiness = mock(ReadingSessionBusiness.class);
        doThrow(new IllegalStateException("provider unavailable"))
            .when(knowledgeBusiness)
            .ensureForBook(42L, 7L);
        BookSavedEventListener listener = new BookSavedEventListener(knowledgeBusiness, sessionBusiness);

        assertThatCode(() -> listener.handle(new BookSavedEvent(42L, 7L)))
            .doesNotThrowAnyException();
    }

    @Test
    void listenerFailureLogContainsOnlySanitizedOperationalMetadata() {
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ReadingSessionBusiness sessionBusiness = mock(ReadingSessionBusiness.class);
        doThrow(new IllegalStateException("provider unavailable"))
            .when(knowledgeBusiness)
            .ensureForBook(42L, 7L);
        BookSavedEventListener listener = new BookSavedEventListener(knowledgeBusiness, sessionBusiness);
        Logger logger = (Logger) LoggerFactory.getLogger(BookSavedEventListener.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            listener.handle(new BookSavedEvent(42L, 7L));

            assertThat(appender.list)
                .anyMatch(event -> event.getFormattedMessage().contains("outcome=FAILURE"));
            assertThat(appender.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage())
                    .doesNotContain("bookId", "userId", "42", "7", "provider unavailable");
                if (event.getArgumentArray() != null) {
                    assertThat(event.getArgumentArray()).noneMatch(value -> value != null
                        && value.toString().contains("provider unavailable"));
                }
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void listenerContinuesKnowledgeGenerationWhenSessionEnsureFails() {
        BookKnowledgeBusiness knowledgeBusiness = mock(BookKnowledgeBusiness.class);
        ReadingSessionBusiness sessionBusiness = mock(ReadingSessionBusiness.class);
        doThrow(new IllegalStateException("session persistence unavailable"))
            .when(sessionBusiness)
            .ensureForBook(42L, 7L);
        BookSavedEventListener listener = new BookSavedEventListener(knowledgeBusiness, sessionBusiness);

        assertThatCode(() -> listener.handle(new BookSavedEvent(42L, 7L)))
            .doesNotThrowAnyException();

        verify(knowledgeBusiness).ensureForBook(42L, 7L);
    }
}
