package com.margins.testsupport.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.testsupport.dto.ResetResponse;
import com.margins.testsupport.service.TestResetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 테스트 reset REST API 진입점이다.
 * 프론트 E2E와 통합 테스트가 사용할 데이터 초기화 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestResetController {

    private final TestResetService testResetService;

    /** 테스트/E2E 실행 전후 데이터를 초기화하는 POST 엔드포인트다. */
    @PostMapping("/reset")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<ResetResponse> reset() {
        return ApiResponse.ok(testResetService.reset());
    }
}
