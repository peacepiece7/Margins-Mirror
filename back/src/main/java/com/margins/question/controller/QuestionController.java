package com.margins.question.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.SaveQuestionAnswerRequest;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.session.dto.ReadingSessionTimelineResponse;
import com.margins.session.service.ReadingSessionService;
import jakarta.validation.Valid;
import com.margins.session.service.SessionWindowService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 질문 REST API 진입점이다.
 * 사용자 작성 질문과 AI 질문 생성/목록 조회 요청을 서비스 계층으로 전달한다.
 */
@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final SessionWindowService sessionWindowService;
    private final ReadingSessionService readingSessionService;

    /** 윈도우 질문을 숨기는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}")
    public ApiResponse<QuestionDto> delete(@PathVariable("id") Long questionId) {
        return ApiResponse.ok(sessionWindowService.deleteQuestion(questionId));
    }

    @PutMapping("/{id}/answer")
    public ApiResponse<ReadingSessionTimelineResponse> saveAnswer(
        @PathVariable("id") Long questionId,
        @Valid @RequestBody SaveQuestionAnswerRequest request
    ) {
        return ApiResponse.ok(readingSessionService.saveQuestionAnswer(questionId, request));
    }

    @PutMapping("/{id}/debate-window")
    public ApiResponse<CreateSessionWindowResponse> ensureDebateWindow(
        @PathVariable("id") Long questionId
    ) {
        return ApiResponse.ok(sessionWindowService.ensureQuestionDebateWindow(questionId));
    }
}
