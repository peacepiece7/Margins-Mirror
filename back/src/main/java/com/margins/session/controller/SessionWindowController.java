package com.margins.session.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.question.dto.CreateQuestionRequest;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionListResponse;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.CreateSessionWindowRequest;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.session.dto.DebateAllMessageRequest;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.dto.UpdateSessionWindowTitleRequest;
import com.margins.session.service.SessionWindowService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * 세션 윈도우 REST API 진입점이다.
 * 윈도우 생성/수정, AI 응답, 페르소나 토론 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/session-windows")
@RequiredArgsConstructor
@Slf4j
public class SessionWindowController {

    private final SessionWindowService sessionWindowService;
    private final ObjectMapper objectMapper;

    /** 독서 세션 안에 새 질문/토론 윈도우를 만드는 POST 엔드포인트다. */
    @PostMapping
    public ApiResponse<CreateSessionWindowResponse> create(@Valid @RequestBody CreateSessionWindowRequest request) {
        return ApiResponse.ok(sessionWindowService.create(request));
    }

    /** 세션 윈도우 제목을 수정하는 PATCH 엔드포인트다. */
    @PatchMapping("/{id}/title")
    public ApiResponse<CreateSessionWindowResponse> updateTitle(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody UpdateSessionWindowTitleRequest request
    ) {
        return ApiResponse.ok(sessionWindowService.updateTitle(windowId, request));
    }

    /** 세션 윈도우를 보관 처리하는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}")
    public ApiResponse<CreateSessionWindowResponse> archive(@PathVariable("id") Long windowId) {
        return ApiResponse.ok(sessionWindowService.archive(windowId));
    }

    /** 윈도우에 독자 메시지를 저장하고 AI 응답을 반환하는 POST 엔드포인트다. */
    @PostMapping("/{id}/messages")
    public ApiResponse<AiMessageResponse> sendMessage(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody SendMessageRequest request
    ) {
        return ApiResponse.ok(sessionWindowService.sendMessage(windowId, request));
    }

    /** 윈도우 AI 응답을 Server-Sent Events로 스트리밍하는 POST 엔드포인트다. */
    @PostMapping(value = "/{id}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public StreamingResponseBody streamMessage(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody SendMessageRequest request
    ) {
        return (outputStream) -> {
            writeEvent(outputStream, "message.start", streamPayload(windowId, "", request.getClientCorrelationId()));
            try {
                AiMessageResponse response = sessionWindowService.streamMessage(windowId, request, (delta) -> writeDelta(outputStream, windowId, delta, request.getClientCorrelationId()));
                writeEvent(outputStream, "message.done", response);
            } catch (UncheckedIOException exception) {
                throw exception.getCause();
            } catch (RuntimeException exception) {
                writeEvent(outputStream, "message.error", errorPayload(windowId, exception, request.getClientCorrelationId()));
            }
        };
    }

    /** 윈도우에 연결된 질문 목록을 조회하는 GET 엔드포인트다. */
    @GetMapping("/{id}/questions")
    public ApiResponse<QuestionListResponse> questions(@PathVariable("id") Long windowId) {
        return ApiResponse.ok(sessionWindowService.questions(windowId));
    }

    /** 독자가 윈도우에 직접 질문을 추가하는 POST 엔드포인트다. */
    @PostMapping("/{id}/questions")
    public ApiResponse<QuestionListResponse> createQuestion(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody CreateQuestionRequest request
    ) {
        return ApiResponse.ok(sessionWindowService.createQuestion(windowId, request));
    }

    /** AI가 윈도우 문맥 기반 질문을 생성하는 POST 엔드포인트다. */
    @PostMapping("/{id}/questions/generate")
    public ApiResponse<QuestionListResponse> generateQuestions(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody GenerateQuestionsRequest request
    ) {
        return ApiResponse.ok(sessionWindowService.generateQuestions(windowId, request));
    }

    /** 선택한 페르소나가 독자 메시지에 응답하는 토론 POST 엔드포인트다. */
    @PostMapping("/{id}/debate")
    public ApiResponse<DebateTurnResponse> debate(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody DebateMessageRequest request
    ) {
        return ApiResponse.ok(sessionWindowService.debate(windowId, request));
    }

    /** 여러 페르소나가 한 번에 토론 응답을 생성하는 POST 엔드포인트다. */
    @PostMapping("/{id}/debate/all")
    public ApiResponse<DebateTurnResponse> debateAll(
        @PathVariable("id") Long windowId,
        @Valid @RequestBody DebateAllMessageRequest request
    ) {
        return ApiResponse.ok(sessionWindowService.debateAll(windowId, request));
    }

    private void writeEvent(OutputStream outputStream, String eventName, Object data) throws IOException {
        outputStream.write(("event: " + eventName + "\n").getBytes(StandardCharsets.UTF_8));
        outputStream.write(("data: " + objectMapper.writeValueAsString(data) + "\n\n").getBytes(StandardCharsets.UTF_8));
        outputStream.flush();
    }

    private void writeDelta(OutputStream outputStream, Long windowId, String delta, String clientCorrelationId) {
        try {
            writeEvent(outputStream, "message.delta", streamPayload(windowId, delta, clientCorrelationId));
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private Map<String, Object> streamPayload(Long windowId, String delta, String clientCorrelationId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("windowId", windowId);
        payload.put("delta", delta);
        if (clientCorrelationId != null) {
            payload.put("clientCorrelationId", clientCorrelationId);
        }
        return payload;
    }

    private Map<String, Object> errorPayload(Long windowId, RuntimeException exception, String clientCorrelationId) {
        ApiErrorCode code = exception instanceof ApiException apiException
            ? apiException.getCode()
            : ApiErrorCode.STREAM_MESSAGE_FAILED;
        log.error("Streaming message failed windowId={} code={}", windowId, code, exception);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("windowId", windowId);
        payload.put("code", code);
        if (clientCorrelationId != null) {
            payload.put("clientCorrelationId", clientCorrelationId);
        }
        return payload;
    }

}
