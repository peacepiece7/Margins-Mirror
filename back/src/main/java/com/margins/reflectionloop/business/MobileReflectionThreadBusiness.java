package com.margins.reflectionloop.business;

import com.margins.auth.support.AuthContext;
import com.margins.reflectionloop.mapper.MobileReflectionThreadMapper;
import com.margins.reflectionloop.model.MobileReflectionThreadRecord;
import com.margins.reflectionloop.model.dto.response.MobileReflectionThreadItemResponse;
import com.margins.reflectionloop.model.dto.response.MobileReflectionThreadListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MobileReflectionThreadBusiness {
    private final ReflectionBusiness reflectionBusiness;
    private final MobileReflectionThreadMapper threadMapper;

    public MobileReflectionThreadListResponse findReadingThreads() {
        reflectionBusiness.requireEnabled();
        return MobileReflectionThreadListResponse.builder()
            .threads(threadMapper.findReadingThreads(AuthContext.requireUserId())
                .stream()
                .map(this::toResponse)
                .toList())
            .build();
    }

    private MobileReflectionThreadItemResponse toResponse(MobileReflectionThreadRecord record) {
        return MobileReflectionThreadItemResponse.builder()
            .bookId(record.getBookId())
            .bookTitle(record.getBookTitle())
            .bookAuthor(record.getBookAuthor())
            .coverImageUrl(record.getCoverImageUrl())
            .sessionId(record.getSessionId())
            .reflectionId(record.getReflectionId())
            .revisionCount(record.getRevisionCount())
            .reflectionPreview(record.getReflectionPreview())
            .interviewId(record.getInterviewId())
            .interviewStatus(record.getInterviewStatus())
            .answeredCount(record.getAnsweredCount())
            .targetAnswers(record.getInterviewId() == null
                ? null
                : ReflectionInterviewBusiness.TARGET_ANSWERS)
            .generatedCount(record.getGeneratedCount())
            .currentQuestion(record.getCurrentQuestion())
            .guideId(record.getGuideId())
            .runId(record.getRunId())
            .runStatus(record.getRunStatus())
            .refinementOutcome(record.getRefinementOutcome())
            .lastActivityAt(record.getLastActivityAt())
            .build();
    }
}
