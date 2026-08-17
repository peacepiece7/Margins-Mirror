package com.margins.moderation.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.dto.ModerationFeedbackRequest;
import com.margins.moderation.service.ModerationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/moderation-events")
@RequiredArgsConstructor
/** 인증된 reader의 moderation event 피드백 API를 제공한다. */
public class ModerationController {
    private final ModerationService moderationService;

    /** 본인 event에 최초 관련성 피드백 하나를 저장한다. */
    @PostMapping("/{id}/feedback")
    public ApiResponse<ModerationEventDto> feedback(
        @PathVariable("id") Long eventId,
        @Valid @RequestBody ModerationFeedbackRequest request
    ) {
        return ApiResponse.ok(moderationService.feedback(eventId, request));
    }
}
