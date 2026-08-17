package com.margins.message.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.message.dto.UpdateMessageRequest;
import com.margins.message.service.MessageService;
import com.margins.session.dto.SessionMessageDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 메시지 REST API 진입점이다.
 * 세션 대화 목록, 작성, 수정, 삭제 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    /** 저장된 메시지 내용을 수정하는 PATCH 엔드포인트다. */
    @PatchMapping("/{id}")
    public ApiResponse<SessionMessageDto> update(
        @PathVariable("id") Long messageId,
        @Valid @RequestBody UpdateMessageRequest request
    ) {
        return ApiResponse.ok(messageService.update(messageId, request));
    }

    /** 저장된 메시지를 숨기는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}")
    public ApiResponse<SessionMessageDto> delete(@PathVariable("id") Long messageId) {
        return ApiResponse.ok(messageService.delete(messageId));
    }
}
