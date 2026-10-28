package com.margins.book.controller;

import com.margins.book.dto.LibraryThreadResponse;
import com.margins.book.service.LibraryThreadService;
import com.margins.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 사용자 Library thread의 bounded page와 summary를 제공하는 REST 진입점이다. */
@RestController
@RequestMapping("/api/library")
@RequiredArgsConstructor
public class LibraryController {

    private final LibraryThreadService libraryThreadService;

    /** 선택한 shelf, loop stage, 정렬과 cursor에 맞는 Library page를 조회한다. */
    @GetMapping("/threads")
    public ApiResponse<LibraryThreadResponse> threads(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String stage,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String cursor,
        @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.ok(libraryThreadService.findThreads(status, stage, sort, cursor, limit));
    }
}
