package com.margins.session.controller;

import com.margins.common.dto.ApiResponse;

import com.margins.session.dto.CreateReadingSessionRequest;
import com.margins.session.dto.CreateReadingSessionResponse;
import com.margins.session.dto.CreateReviewCommentRequest;
import com.margins.session.dto.CreateSessionHighlightRequest;
import com.margins.session.dto.CreateSessionInsightRequest;
import com.margins.session.dto.CreateSessionTagRequest;
import com.margins.session.dto.PublicReviewListResponse;
import com.margins.session.dto.ReadingSessionTimelineResponse;
import com.margins.session.dto.ReviewCommentListResponse;
import com.margins.session.dto.SessionSearchResponse;
import com.margins.session.dto.UpdateSessionHighlightRequest;
import com.margins.session.dto.UpdateSessionInsightRequest;

import com.margins.session.dto.UpdateReadingSessionTitleRequest;
import com.margins.session.dto.UpdateReviewCommentRequest;
import com.margins.session.service.ReadingSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 독서 세션 REST API 진입점이다.
 * 세션 CRUD, 검색, 타임라인, 태그, 리뷰 관련 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/reading-sessions")
@RequiredArgsConstructor
public class ReadingSessionController {

    private final ReadingSessionService readingSessionService;

    /** 저장된 책으로 독서 세션을 시작하는 POST 엔드포인트다. */
    @PostMapping
    public ApiResponse<CreateReadingSessionResponse> create(@Valid @RequestBody CreateReadingSessionRequest request) {
        return ApiResponse.ok(readingSessionService.create(request));
    }

    /** 독서 기억 검색용 GET 엔드포인트다. */
    @GetMapping("/search")
    public ApiResponse<SessionSearchResponse> search(@RequestParam(value = "query", required = false) String query) {
        return ApiResponse.ok(readingSessionService.search(query));
    }

    /** 공개 리뷰 탐색 카드를 제공하는 GET 엔드포인트다. */
    @GetMapping("/public-reviews")
    public ApiResponse<PublicReviewListResponse> publicReviews() {
        return ApiResponse.ok(readingSessionService.findPublicReviews());
    }

    /** 공개 리뷰 하나의 댓글 스레드를 제공하는 GET 엔드포인트다. */
    @GetMapping("/public-reviews/{insightId}/comments")
    public ApiResponse<ReviewCommentListResponse> reviewComments(@PathVariable("insightId") Long insightId) {
        return ApiResponse.ok(readingSessionService.findReviewComments(insightId));
    }

    /** 리뷰 댓글 또는 답글을 생성하는 POST 엔드포인트다. */
    @PostMapping("/public-reviews/{insightId}/comments")
    public ApiResponse<ReviewCommentListResponse> createReviewComment(
        @PathVariable("insightId") Long insightId,
        @Valid @RequestBody CreateReviewCommentRequest request
    ) {
        return ApiResponse.ok(readingSessionService.createReviewComment(insightId, request));
    }

    /** 리뷰 댓글을 수정하는 PATCH 엔드포인트다. */
    @PatchMapping("/public-reviews/{insightId}/comments/{commentId}")
    public ApiResponse<ReviewCommentListResponse> updateReviewComment(
        @PathVariable("insightId") Long insightId,
        @PathVariable("commentId") Long commentId,
        @Valid @RequestBody UpdateReviewCommentRequest request
    ) {
        return ApiResponse.ok(readingSessionService.updateReviewComment(insightId, commentId, request));
    }

    /** 리뷰 댓글을 숨기는 DELETE 엔드포인트다. */
    @DeleteMapping("/public-reviews/{insightId}/comments/{commentId}")
    public ApiResponse<ReviewCommentListResponse> deleteReviewComment(
        @PathVariable("insightId") Long insightId,
        @PathVariable("commentId") Long commentId
    ) {
        return ApiResponse.ok(readingSessionService.deleteReviewComment(insightId, commentId));
    }

    /** 기본 작업 공간 timeline을 제공하는 GET 엔드포인트다. */
    @GetMapping("/latest")
    public ApiResponse<ReadingSessionTimelineResponse> latest() {
        return ApiResponse.ok(readingSessionService.findLatestTimeline());
    }

    /** 전체 세션 timeline 하나를 제공하는 GET 엔드포인트다. */
    @GetMapping("/{id}")
    public ApiResponse<ReadingSessionTimelineResponse> timeline(@PathVariable("id") Long sessionId) {
        return ApiResponse.ok(readingSessionService.findTimeline(sessionId));
    }


    /** 독서 세션을 보관 처리하는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@PathVariable("id") Long sessionId) {
        readingSessionService.archive(sessionId);
        return ApiResponse.ok(null);
    }

    /** 독서 세션 이름을 바꾸는 PATCH 엔드포인트다. */
    @PatchMapping("/{id}/title")
    public ApiResponse<ReadingSessionTimelineResponse> updateTitle(
        @PathVariable("id") Long sessionId,
        @Valid @RequestBody UpdateReadingSessionTitleRequest request
    ) {
        return ApiResponse.ok(readingSessionService.updateTitle(sessionId, request));
    }


    /** 인용문 또는 메모 하이라이트를 저장하는 POST 엔드포인트다. */
    @PostMapping("/{id}/highlights")
    public ApiResponse<ReadingSessionTimelineResponse> createHighlight(
        @PathVariable("id") Long sessionId,
        @Valid @RequestBody CreateSessionHighlightRequest request
    ) {
        return ApiResponse.ok(readingSessionService.createHighlight(sessionId, request));
    }

    /** 인용문 또는 메모 하이라이트를 수정하는 PATCH 엔드포인트다. */
    @PatchMapping("/{id}/highlights/{highlightId}")
    public ApiResponse<ReadingSessionTimelineResponse> updateHighlight(
        @PathVariable("id") Long sessionId,
        @PathVariable("highlightId") Long highlightId,
        @Valid @RequestBody UpdateSessionHighlightRequest request
    ) {
        return ApiResponse.ok(readingSessionService.updateHighlight(sessionId, highlightId, request));
    }

    /** 인용문 또는 메모 하이라이트를 숨기는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}/highlights/{highlightId}")
    public ApiResponse<ReadingSessionTimelineResponse> deleteHighlight(
        @PathVariable("id") Long sessionId,
        @PathVariable("highlightId") Long highlightId
    ) {
        return ApiResponse.ok(readingSessionService.deleteHighlight(sessionId, highlightId));
    }

    /** 세션 태그를 추가하는 POST 엔드포인트다. */
    @PostMapping("/{id}/tags")
    public ApiResponse<ReadingSessionTimelineResponse> createTag(
        @PathVariable("id") Long sessionId,
        @Valid @RequestBody CreateSessionTagRequest request
    ) {
        return ApiResponse.ok(readingSessionService.createTag(sessionId, request));
    }

    /** 세션 태그를 숨기는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}/tags/{tagId}")
    public ApiResponse<ReadingSessionTimelineResponse> deleteTag(
        @PathVariable("id") Long sessionId,
        @PathVariable("tagId") Long tagId
    ) {
        return ApiResponse.ok(readingSessionService.deleteTag(sessionId, tagId));
    }

    /** 인사이트 또는 공개 리뷰를 추가하는 POST 엔드포인트다. */
    @PostMapping("/{id}/insights")
    public ApiResponse<ReadingSessionTimelineResponse> createInsight(
        @PathVariable("id") Long sessionId,
        @Valid @RequestBody CreateSessionInsightRequest request
    ) {
        return ApiResponse.ok(readingSessionService.createInsight(sessionId, request));
    }

    /** 인사이트 또는 공개 리뷰를 수정하는 PATCH 엔드포인트다. */
    @PatchMapping("/{id}/insights/{insightId}")
    public ApiResponse<ReadingSessionTimelineResponse> updateInsight(
        @PathVariable("id") Long sessionId,
        @PathVariable("insightId") Long insightId,
        @Valid @RequestBody UpdateSessionInsightRequest request
    ) {
        return ApiResponse.ok(readingSessionService.updateInsight(sessionId, insightId, request));
    }

    /** 인사이트 또는 공개 리뷰를 숨기는 DELETE 엔드포인트다. */
    @DeleteMapping("/{id}/insights/{insightId}")
    public ApiResponse<ReadingSessionTimelineResponse> deleteInsight(
        @PathVariable("id") Long sessionId,
        @PathVariable("insightId") Long insightId
    ) {
        return ApiResponse.ok(readingSessionService.deleteInsight(sessionId, insightId));
    }
}
