package com.margins.book.controller;

import com.margins.book.dto.BookBackgroundDto;
import com.margins.book.dto.UpdateBookBackgroundRequest;
import com.margins.book.service.BookBackgroundService;
import com.margins.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books/{bookId}/knowledge/summary")
@RequiredArgsConstructor
public class BookBackgroundController {
    private final BookBackgroundService background;

    /** 개인 배경 설명 조회 API로서 AI 생성 작업을 시작하지 않는다. */
    @GetMapping
    public ApiResponse<BookBackgroundDto> find(@PathVariable Long bookId) {
        return ApiResponse.ok(background.find(bookId));
    }

    /** 명시적 수정 또는 null 복원을 소유권·버전 검증 뒤 저장한다. */
    @PatchMapping
    public ApiResponse<BookBackgroundDto> update(
        @PathVariable Long bookId, @Valid @RequestBody UpdateBookBackgroundRequest request
    ) {
        return ApiResponse.ok(background.update(bookId, request));
    }
}
