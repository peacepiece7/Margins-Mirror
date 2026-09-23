package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.ai.GenerationLocale;
import com.margins.book.business.BookBusiness;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.business.BookKnowledgeBusiness.RegenerationRequest;
import com.margins.book.business.BookKnowledgeBusiness.RegenerationWork;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.book.model.BookRecord;
import com.margins.book.service.BookKnowledgeRegenerationScheduler;
import com.margins.book.service.BookService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class BookServiceAsyncRegenerationTest {

    @Test
    void returnsAcceptedProjectionBeforeQueuedProviderWorkRuns() {
        BookKnowledgeBusiness business = mock(BookKnowledgeBusiness.class);
        AtomicReference<Runnable> queued = new AtomicReference<>();
        BookKnowledgeRegenerationScheduler scheduler =
            new BookKnowledgeRegenerationScheduler(business, queued::set);
        BookService service = service(business, scheduler);
        BookKnowledgeDto accepted = acceptedKnowledge();
        RegenerationWork work = work();
        when(business.requestRegeneration(52L))
            .thenReturn(new RegenerationRequest(accepted, work));

        BookKnowledgeDto response = service.regenerateBookKnowledge(52L);

        assertThat(response).isSameAs(accepted);
        assertThat(queued.get()).isNotNull();
        verify(business, never()).completeRegeneration(work);

        queued.get().run();

        verify(business).completeRegeneration(work);
    }

    @Test
    void activeClaimReturnsAcceptedProjectionWithoutSchedulingDuplicateWork() {
        BookKnowledgeBusiness business = mock(BookKnowledgeBusiness.class);
        AtomicReference<Runnable> queued = new AtomicReference<>();
        BookKnowledgeRegenerationScheduler scheduler =
            new BookKnowledgeRegenerationScheduler(business, queued::set);
        BookService service = service(business, scheduler);
        BookKnowledgeDto accepted = acceptedKnowledge();
        when(business.requestRegeneration(52L))
            .thenReturn(new RegenerationRequest(accepted, null));

        BookKnowledgeDto response = service.regenerateBookKnowledge(52L);

        assertThat(response).isSameAs(accepted);
        assertThat(queued.get()).isNull();
        verify(business, never()).completeRegeneration(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void queueRejectionClearsClaimAndReturnsServiceUnavailable() {
        BookKnowledgeBusiness business = mock(BookKnowledgeBusiness.class);
        Executor rejecting = command -> {
            throw new RejectedExecutionException("queue full");
        };
        BookKnowledgeRegenerationScheduler scheduler =
            new BookKnowledgeRegenerationScheduler(business, rejecting);
        BookService service = service(business, scheduler);
        RegenerationWork work = work();
        when(business.requestRegeneration(52L))
            .thenReturn(new RegenerationRequest(acceptedKnowledge(), work));

        assertThatThrownBy(() -> service.regenerateBookKnowledge(52L))
            .isInstanceOf(ApiException.class)
            .extracting(exception -> ((ApiException) exception).getCode())
            .isEqualTo(ApiErrorCode.COMMON_SERVICE_UNAVAILABLE);

        verify(business).rejectRegeneration(work);
        verify(business, never()).completeRegeneration(work);
    }

    @Test
    void workerFailureClearsTheClaimThroughTheExistingFailurePath() {
        BookKnowledgeBusiness business = mock(BookKnowledgeBusiness.class);
        AtomicReference<Runnable> queued = new AtomicReference<>();
        BookKnowledgeRegenerationScheduler scheduler =
            new BookKnowledgeRegenerationScheduler(business, queued::set);
        RegenerationWork work = work();
        org.mockito.Mockito.doThrow(new IllegalStateException("worker failed"))
            .when(business).completeRegeneration(work);

        scheduler.schedule(work);
        queued.get().run();

        verify(business).failRegeneration(work);
    }

    private BookService service(
        BookKnowledgeBusiness business,
        BookKnowledgeRegenerationScheduler scheduler
    ) {
        return new BookService(
            mock(BookBusiness.class),
            business,
            mock(ApplicationEventPublisher.class),
            scheduler
        );
    }

    private BookKnowledgeDto acceptedKnowledge() {
        return BookKnowledgeDto.builder()
            .knowledgeId(10L)
            .title("Accepted")
            .generationLocale("ko")
            .status("ready")
            .refreshPending(true)
            .build();
    }

    private RegenerationWork work() {
        return new RegenerationWork(
            BookRecord.builder().id(52L).build(),
            BookKnowledgeRecord.builder().id(10L).build(),
            "claim-token",
            GenerationLocale.KO
        );
    }
}
