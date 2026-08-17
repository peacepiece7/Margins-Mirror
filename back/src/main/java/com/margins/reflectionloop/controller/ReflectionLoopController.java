package com.margins.reflectionloop.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.model.dto.request.CompleteDiscussionRunRequest;
import com.margins.reflectionloop.model.dto.request.EditDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.GuideBriefRequest;
import com.margins.reflectionloop.model.dto.request.GuidedDiscussionTurnRequest;
import com.margins.reflectionloop.model.dto.request.InterviewResponseRequest;
import com.margins.reflectionloop.model.dto.request.RegenerateDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRefinementRequest;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRequest;
import com.margins.reflectionloop.model.dto.request.UpdateInterviewAnswerRequest;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideMarkdownExportResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideProjectionResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideVersionsResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionRunResponse;
import com.margins.reflectionloop.model.dto.response.GuidedDiscussionTurnResponse;
import com.margins.reflectionloop.model.dto.response.ReflectionInterviewResponse;
import com.margins.reflectionloop.model.dto.response.ReflectionLoopResponse;
import com.margins.reflectionloop.model.dto.response.ReflectionRefinementResponse;
import com.margins.reflectionloop.service.ReflectionLoopService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ReflectionLoopController {
    private final ReflectionLoopService reflectionLoopService;

    @PostMapping("/api/reading-sessions/{sessionId}/reflections")
    public ApiResponse<ReflectionLoopResponse> createReflection(
        @PathVariable Long sessionId,
        @Valid @RequestBody SaveReflectionRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.createReflection(sessionId, request));
    }

    @GetMapping("/api/reflections/{reflectionId}")
    public ApiResponse<ReflectionLoopResponse> reflection(@PathVariable Long reflectionId) {
        return ApiResponse.ok(reflectionLoopService.reflection(reflectionId));
    }

    @GetMapping("/api/reading-sessions/{sessionId}/reflection")
    public ApiResponse<ReflectionLoopResponse> sessionReflection(@PathVariable Long sessionId) {
        return ApiResponse.ok(reflectionLoopService.sessionReflection(sessionId));
    }

    @PatchMapping("/api/reflections/{reflectionId}")
    public ApiResponse<ReflectionLoopResponse> updateReflection(
        @PathVariable Long reflectionId,
        @Valid @RequestBody SaveReflectionRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.updateReflection(reflectionId, request));
    }

    @PostMapping("/api/reflections/{reflectionId}/interviews")
    public ApiResponse<ReflectionInterviewResponse> startInterview(@PathVariable Long reflectionId) {
        return ApiResponse.ok(reflectionLoopService.startInterview(reflectionId));
    }

    @GetMapping("/api/reflection-interviews/{interviewId}")
    public ApiResponse<ReflectionInterviewResponse> interview(@PathVariable Long interviewId) {
        return ApiResponse.ok(reflectionLoopService.interview(interviewId));
    }

    @PostMapping("/api/reflection-interviews/{interviewId}/responses")
    public ApiResponse<ReflectionInterviewResponse> respond(
        @PathVariable Long interviewId,
        @Valid @RequestBody InterviewResponseRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.respond(interviewId, request));
    }

    @PutMapping("/api/reflection-interviews/{interviewId}/answers/{questionId}")
    public ApiResponse<ReflectionInterviewResponse> updateAnswer(
        @PathVariable Long interviewId,
        @PathVariable Long questionId,
        @Valid @RequestBody UpdateInterviewAnswerRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.updateAnswer(interviewId, questionId, request));
    }

    @PostMapping("/api/reflection-interviews/{interviewId}/continue")
    public ApiResponse<ReflectionInterviewResponse> continueInterview(
        @PathVariable Long interviewId
    ) {
        return ApiResponse.ok(reflectionLoopService.continueInterview(interviewId));
    }

    @PostMapping("/api/reflection-interviews/{interviewId}/guides")
    public ApiResponse<DiscussionGuideResponse> createGuide(
        @PathVariable Long interviewId,
        @Valid @RequestBody GuideBriefRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.createGuide(interviewId, request));
    }

    @GetMapping("/api/reflection-interviews/{interviewId}/guides")
    public ApiResponse<DiscussionGuideVersionsResponse> guideVersions(
        @PathVariable Long interviewId
    ) {
        return ApiResponse.ok(reflectionLoopService.guideVersions(interviewId));
    }

    @GetMapping("/api/discussion-guides/{guideId}")
    public ApiResponse<DiscussionGuideResponse> guide(@PathVariable Long guideId) {
        return ApiResponse.ok(reflectionLoopService.guide(guideId));
    }

    @GetMapping("/api/discussion-guides/{guideId}/projections/{projection}")
    public ApiResponse<DiscussionGuideProjectionResponse> guideProjection(
        @PathVariable Long guideId,
        @PathVariable String projection
    ) {
        return ApiResponse.ok(reflectionLoopService.guideProjection(guideId, projection));
    }

    @GetMapping("/api/discussion-guides/{guideId}/exports/markdown")
    public ApiResponse<DiscussionGuideMarkdownExportResponse> guideMarkdown(
        @PathVariable Long guideId,
        @RequestParam(required = false) String projection
    ) {
        if (projection == null || projection.isBlank()) {
            throw new ApiException(
                ApiErrorCode.COMMON_BAD_REQUEST,
                "Discussion guide projection is required"
            );
        }
        return ApiResponse.ok(reflectionLoopService.guideMarkdown(guideId, projection));
    }

    @PostMapping("/api/discussion-guides/{guideId}/versions")
    public ApiResponse<DiscussionGuideResponse> editGuide(
        @PathVariable Long guideId,
        @Valid @RequestBody EditDiscussionGuideRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.editGuide(guideId, request));
    }

    @PostMapping("/api/discussion-guides/{guideId}/regenerate")
    public ApiResponse<DiscussionGuideResponse> regenerateGuide(
        @PathVariable Long guideId,
        @Valid @RequestBody RegenerateDiscussionGuideRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.regenerateGuide(guideId, request));
    }

    @PostMapping("/api/discussion-guides/{guideId}/runs")
    public ApiResponse<DiscussionRunResponse> createRun(@PathVariable Long guideId) {
        return ApiResponse.ok(reflectionLoopService.createRun(guideId));
    }

    @GetMapping("/api/discussion-runs/{runId}")
    public ApiResponse<DiscussionRunResponse> run(@PathVariable Long runId) {
        return ApiResponse.ok(reflectionLoopService.run(runId));
    }

    @PostMapping("/api/discussion-runs/{runId}/turns")
    public ApiResponse<GuidedDiscussionTurnResponse> turn(
        @PathVariable Long runId,
        @Valid @RequestBody GuidedDiscussionTurnRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.turn(runId, request));
    }

    @PostMapping("/api/discussion-runs/{runId}/complete")
    public ApiResponse<ReflectionRefinementResponse> complete(
        @PathVariable Long runId,
        @Valid @RequestBody(required = false) CompleteDiscussionRunRequest request
    ) {
        CompleteDiscussionRunRequest resolved = request == null
            ? CompleteDiscussionRunRequest.builder().build()
            : request;
        return ApiResponse.ok(reflectionLoopService.complete(runId, resolved));
    }

    @GetMapping("/api/discussion-runs/{runId}/refinement")
    public ApiResponse<ReflectionRefinementResponse> refinement(@PathVariable Long runId) {
        return ApiResponse.ok(reflectionLoopService.refinement(runId));
    }

    @PostMapping("/api/discussion-runs/{runId}/refinement")
    public ApiResponse<ReflectionLoopResponse> refine(
        @PathVariable Long runId,
        @Valid @RequestBody SaveReflectionRefinementRequest request
    ) {
        return ApiResponse.ok(reflectionLoopService.refine(runId, request));
    }
}
