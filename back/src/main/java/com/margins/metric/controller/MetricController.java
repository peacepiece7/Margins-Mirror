package com.margins.metric.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.metric.dto.MetricSnapshotResponse;
import com.margins.metric.service.MetricService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 독서 세션 지표 REST API 진입점이다.
 * 특정 세션의 metric snapshot 조회 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/reading-sessions/{id}/metrics")
@RequiredArgsConstructor
public class MetricController {

    private final MetricService metricService;

    /** 특정 독서 세션의 현재 metric snapshot을 계산해 반환하는 POST 엔드포인트다. */
    @PostMapping("/snapshot")
    public ApiResponse<MetricSnapshotResponse> createSnapshot(@PathVariable("id") Long sessionId) {
        return ApiResponse.ok(metricService.createSessionSnapshot(sessionId));
    }
}
