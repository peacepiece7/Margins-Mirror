package com.margins.book.service;

import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.business.BookKnowledgeBusiness.RegenerationWork;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class BookKnowledgeRegenerationScheduler {

    private final BookKnowledgeBusiness bookKnowledgeBusiness;
    private final Executor executor;

    public BookKnowledgeRegenerationScheduler(
        BookKnowledgeBusiness bookKnowledgeBusiness,
        @Qualifier("bookKnowledgeTaskExecutor") Executor executor
    ) {
        this.bookKnowledgeBusiness = bookKnowledgeBusiness;
        this.executor = executor;
    }

    public void schedule(RegenerationWork work) {
        try {
            executor.execute(() -> complete(work));
        } catch (RuntimeException exception) {
            bookKnowledgeBusiness.rejectRegeneration(work);
            throw new ApiException(
                ApiErrorCode.COMMON_SERVICE_UNAVAILABLE,
                "Book Knowledge generation could not be scheduled"
            );
        }
    }

    private void complete(RegenerationWork work) {
        try {
            bookKnowledgeBusiness.completeRegeneration(work);
        } catch (RuntimeException exception) {
            log.warn(
                "Asynchronous Book Knowledge generation ended with an error. "
                    + "outcome=FAILURE, errorType={}",
                exception.getClass().getSimpleName()
            );
            try {
                bookKnowledgeBusiness.failRegeneration(work);
            } catch (RuntimeException cleanupException) {
                log.warn(
                    "Asynchronous Book Knowledge claim cleanup failed. "
                        + "outcome=FAILURE, errorType={}",
                    cleanupException.getClass().getSimpleName()
                );
            }
        }
    }
}
