package com.margins.book.controller;

import com.margins.book.dto.BookListResponse;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.dto.BookCandidateSearchRequest;
import com.margins.book.dto.BookCandidateSearchResponse;
import com.margins.book.dto.SaveBookRequest;
import com.margins.book.dto.SaveBookResponse;
import com.margins.book.dto.UpdateBookRequest;
import com.margins.book.dto.UpdateBookShelfRequest;
import com.margins.book.service.BookService;
import com.margins.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 책 REST API 진입점이다.
 * 검색, 저장, 서재 조회, 상태/정보 수정, 삭제 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/books")
@RequiredArgsConstructor
public class BookController {

    private final BookService bookService;

    /** 제공자 또는 AI 책 후보 검색용 POST 엔드포인트다. */
    @PostMapping("/search-candidates")
    public ApiResponse<BookCandidateSearchResponse> searchCandidates(@Valid @RequestBody BookCandidateSearchRequest request) {
        return ApiResponse.ok(bookService.searchCandidates(request));
    }

    /** 선택 필터와 정렬 쿼리를 받는 저장 책 서재 GET 엔드포인트다. */
    @GetMapping
    public ApiResponse<BookListResponse> list(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String sort
    ) {
        return ApiResponse.ok(bookService.findSavedBooks(status, sort));
    }

    /** 후보 또는 수동 입력을 저장 책으로 바꾸는 POST 엔드포인트다. */
    @PostMapping
    public ApiResponse<SaveBookResponse> saveBook(@Valid @RequestBody SaveBookRequest request) {
        return ApiResponse.ok(bookService.saveBook(request));
    }

    @GetMapping("/{bookId}/knowledge")
    public ApiResponse<BookKnowledgeDto> findBookKnowledge(@PathVariable Long bookId) {
        return ApiResponse.ok(bookService.findBookKnowledge(bookId));
    }

    @PostMapping("/{bookId}/knowledge/regenerate")
    public ApiResponse<BookKnowledgeDto> regenerateBookKnowledge(@PathVariable Long bookId) {
        return ApiResponse.ok(bookService.regenerateBookKnowledge(bookId));
    }

    /** 독자가 수정할 수 있는 제목/저자 메타데이터용 PATCH 엔드포인트다. */
    @PatchMapping("/{bookId}")
    public ApiResponse<SaveBookResponse> updateBook(
        @PathVariable Long bookId,
        @Valid @RequestBody UpdateBookRequest request
    ) {
        return ApiResponse.ok(bookService.updateBook(bookId, request));
    }

    /** 서재 상태와 평점 변경용 PATCH 엔드포인트다. */
    @PatchMapping("/{bookId}/shelf")
    public ApiResponse<SaveBookResponse> updateBookShelf(
        @PathVariable Long bookId,
        @Valid @RequestBody UpdateBookShelfRequest request
    ) {
        return ApiResponse.ok(bookService.updateBookShelf(bookId, request));
    }

    /** 저장 책을 소프트 삭제하는 DELETE 엔드포인트다. */
    @DeleteMapping("/{bookId}")
    public ApiResponse<Void> deleteBook(@PathVariable Long bookId) {
        bookService.deleteBook(bookId);
        return ApiResponse.ok(null);
    }
}
