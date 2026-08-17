package com.margins.book.event;

import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.session.business.ReadingSessionBusiness;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class BookSavedEventListener {

    private final BookKnowledgeBusiness bookKnowledgeBusiness;
    private final ReadingSessionBusiness readingSessionBusiness;

    @Async("bookKnowledgeTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(BookSavedEvent event) {
        try {
            readingSessionBusiness.ensureForBook(event.bookId(), event.userId());
        } catch (RuntimeException exception) {
            log.error(
                "Asynchronous reading session creation failed. bookId={}, userId={}, error={}",
                event.bookId(), event.userId(), exception.getClass().getSimpleName(), exception
            );
        }
        try {
            bookKnowledgeBusiness.ensureForBook(event.bookId(), event.userId());
        } catch (RuntimeException exception) {
            log.error(
                "Asynchronous book knowledge generation failed. outcome=FAILURE, errorType={}",
                exception.getClass().getSimpleName()
            );
        }
    }
}
