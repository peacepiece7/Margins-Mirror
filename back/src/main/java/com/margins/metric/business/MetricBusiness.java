package com.margins.metric.business;

import com.margins.auth.support.AuthContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.metric.dto.MetricSnapshotResponse;
import com.margins.metric.mapper.MetricMapper;
import com.margins.metric.model.MetricRecord;
import com.margins.metric.model.SessionMetricSourceRecord;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 독서 세션 지표의 계산 규칙을 처리한다.
 * 세션 활동, 질문, 메시지, 하이라이트 데이터를 모아 스냅샷으로 만든다.
 */
@Component
@RequiredArgsConstructor
public class MetricBusiness {

    /** metric source 소유권 검사를 위해 현재 사용자를 확인한다. */
    private long currentUserId() {
        return AuthContext.requireUserId();
    }
    private static final String SESSION_SNAPSHOT = "session_snapshot";

    private final MetricMapper metricMapper;
    private final ObjectMapper objectMapper;

    /** 현재 timeline source row에서 산출한 session-scope metric snapshot을 append한다. */
    public MetricSnapshotResponse createSessionSnapshot(Long sessionId) {
        SessionMetricSourceRecord source = metricMapper.findSessionSource(sessionId, currentUserId());
        if (source == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reading session not found");
        }

        MetricRecord record = MetricRecord.builder()
            .userId(source.getUserId())
            .bookId(source.getBookId())
            .sessionId(source.getSessionId())
            .metricName(SESSION_SNAPSHOT)
            .metricScope("session")
            .metricValue(null)
            .metricUnit(null)
            .metricDetails(detailsJson(source))
            .sourceRef("session:" + source.getSessionId() + ":snapshot")
            .generatedBy("reader")
            .testData(true)
            .build();

        if (metricMapper.insert(record) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Metric snapshot could not be saved");
        }
        return toResponse(record, source);
    }

    /** 저장된 snapshot과 이를 만드는 데 사용한 source count를 함께 반환한다. */
    private MetricSnapshotResponse toResponse(MetricRecord record, SessionMetricSourceRecord source) {
        return MetricSnapshotResponse.builder()
            .metricId(record.getId())
            .sessionId(source.getSessionId())
            .metricName(record.getMetricName())
            .metricValue(record.getMetricValue())
            .metricUnit(record.getMetricUnit())
            .windowCount(source.getWindowCount())
            .questionCount(source.getQuestionCount())
            .answeredQuestionCount(source.getAnsweredQuestionCount())
            .highlightCount(source.getHighlightCount())
            .messageCount(source.getMessageCount())
            .personaCount(source.getPersonaCount())
            .build();
    }

    /** 향후 분석를 위해 metric source count를 JSON detail payload로 직렬화한다. */
    private String detailsJson(SessionMetricSourceRecord source) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("windowCount", source.getWindowCount());
        details.put("questionCount", source.getQuestionCount());
        details.put("answeredQuestionCount", source.getAnsweredQuestionCount());
        details.put("highlightCount", source.getHighlightCount());
        details.put("messageCount", source.getMessageCount());
        details.put("personaCount", source.getPersonaCount());

        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Metric details could not be serialized", exception);
        }
    }

}
