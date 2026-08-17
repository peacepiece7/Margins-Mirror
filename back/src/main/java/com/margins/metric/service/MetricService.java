package com.margins.metric.service;

import com.margins.metric.business.MetricBusiness;
import com.margins.metric.dto.MetricSnapshotResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 지표 비즈니스 로직 사이의 서비스 계층이다.
 * 세션 지표 조회 요청을 계산 로직에 위임한다.
 */
@Service
@RequiredArgsConstructor
public class MetricService {

    private final MetricBusiness metricBusiness;

    @Transactional
    public MetricSnapshotResponse createSessionSnapshot(Long sessionId) {
        return metricBusiness.createSessionSnapshot(sessionId);
    }
}
