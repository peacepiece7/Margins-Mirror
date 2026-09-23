package com.margins.reflectionloop.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.reflectionloop.model.dto.response.MobileReflectionThreadListResponse;
import com.margins.reflectionloop.service.MobileReflectionThreadService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MobileReflectionThreadController {
    private final MobileReflectionThreadService threadService;

    /** [Mobile client API] 읽는 중인 책별 현재 Reflection Loop stage를 한 번에 조회한다. */
    @GetMapping("/api/mobile/reflection-threads")
    public ApiResponse<MobileReflectionThreadListResponse> readingThreads() {
        return ApiResponse.ok(threadService.findReadingThreads());
    }
}
