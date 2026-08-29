package com.margins.session.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.session.dto.BookReadingSessionResponse;
import com.margins.session.service.ReadingSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 저장 책과 독서 세션 사이의 가벼운 조회 API 진입점이다.
 * 책별 최신 세션 식별자와 표시 제목만 읽는다.
 */
@RestController
@RequestMapping("/api/books/{bookId}/reading-session")
@RequiredArgsConstructor
public class BookReadingSessionController {

    private final ReadingSessionService readingSessionService;

    /** 접근 가능한 책의 최신 독서 세션 locator를 제공하는 GET 엔드포인트다. */
    @GetMapping
    public ApiResponse<BookReadingSessionResponse> find(@PathVariable Long bookId) {
        return ApiResponse.ok(readingSessionService.findForBook(bookId));
    }
}
