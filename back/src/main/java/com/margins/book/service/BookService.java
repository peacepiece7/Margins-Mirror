package com.margins.book.service;

import com.margins.auth.support.AuthContext;
import com.margins.book.business.BookBusiness;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.dto.BookListResponse;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.dto.BookCandidateSearchRequest;
import com.margins.book.dto.BookCandidateSearchResponse;
import com.margins.book.dto.SaveBookRequest;
import com.margins.book.dto.SaveBookResponse;
import com.margins.book.dto.UpdateBookRequest;
import com.margins.book.dto.UpdateBookShelfRequest;
import com.margins.book.event.BookSavedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 책 비즈니스 로직 사이의 서비스 계층이다.
 * 책 검색/저장/서재 변경 요청을 업무 규칙으로 위임한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookService {

    private final BookBusiness bookBusiness;
    private final BookKnowledgeBusiness bookKnowledgeBusiness;
    private final ApplicationEventPublisher eventPublisher;

    public BookCandidateSearchResponse searchCandidates(BookCandidateSearchRequest request) {
        return bookBusiness.searchCandidates(request);
    }

    /** 읽기 전용 트랜잭션에서 사용자 서재를 읽는다. */
    @Transactional(readOnly = true)
    public BookListResponse findSavedBooks(String status, String sort) {
        return bookBusiness.findSavedBooks(status, sort);
    }

    /** 책을 저장하고 commit 이후 비동기 Book Knowledge 생성을 예약한다. */
    @Transactional
    public SaveBookResponse saveBook(SaveBookRequest request) {
        Long userId = AuthContext.requireUserId();
        SaveBookResponse response = bookBusiness.saveBook(request);

        try {
            eventPublisher.publishEvent(new BookSavedEvent(response.getBookId(), userId));
        } catch (RuntimeException exception) {
            log.error(
                "Book Knowledge event publication failed. outcome=FAILURE, errorType={}",
                exception.getClass().getSimpleName()
            );
        }
        return response;
    }

    @Transactional(readOnly = true)
    public BookKnowledgeDto findBookKnowledge(Long bookId) {
        return bookKnowledgeBusiness.findForBook(bookId);
    }

    public BookKnowledgeDto regenerateBookKnowledge(Long bookId) {
        return bookKnowledgeBusiness.regenerate(bookId);
    }

    /** 책 식별 필드와 재생성된 메타데이터를 원자적으로 수정한다. */
    @Transactional
    public SaveBookResponse updateBook(Long bookId, UpdateBookRequest request) {
        return bookBusiness.updateBook(bookId, request);
    }

    /** 서재 상태와 관련 시각을 원자적으로 수정한다. */
    @Transactional
    public SaveBookResponse updateBookShelf(Long bookId, UpdateBookShelfRequest request) {
        return bookBusiness.updateBookShelf(bookId, request);
    }

    /** 트랜잭션 하나에서 책을 소프트 삭제한다. */
    @Transactional
    public void deleteBook(Long bookId) {
        bookBusiness.deleteBook(bookId);
    }
}
