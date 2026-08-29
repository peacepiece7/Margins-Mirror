package com.margins.session.service;

import com.margins.session.business.ReadingSessionBusiness;

import com.margins.session.dto.BookReadingSessionResponse;
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
import com.margins.question.dto.SaveQuestionAnswerRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 독서 세션 비즈니스 로직 사이의 서비스 계층이다.
 * 세션, 타임라인, 검색, 태그, 리뷰 요청을 업무 규칙으로 위임한다.
 */
@Service
@RequiredArgsConstructor
public class ReadingSessionService {

    private final ReadingSessionBusiness readingSessionBusiness;

    @Transactional
    public ReadingSessionTimelineResponse saveQuestionAnswer(
        Long questionId,
        SaveQuestionAnswerRequest request
    ) {
        return readingSessionBusiness.saveQuestionAnswer(questionId, request);
    }

    /** 독서 세션을 만들고 소유자와 책 관계를 저장한다. */
    @Transactional
    public CreateReadingSessionResponse create(CreateReadingSessionRequest request) {
        return readingSessionBusiness.create(request);
    }

    /** 초기 작업 공간 복원을 위해 최신 timeline을 읽는다. */
    @Transactional(readOnly = true)
    public ReadingSessionTimelineResponse findLatestTimeline() {
        return readingSessionBusiness.findLatestTimeline();
    }

    /** 세션 상태를 바꾸지 않고 전체 timeline 하나를 읽는다. */
    @Transactional(readOnly = true)
    public ReadingSessionTimelineResponse findTimeline(Long sessionId) {
        return readingSessionBusiness.findTimeline(sessionId);
    }

    /** 책별 최신 독서 세션의 식별자와 표시 제목만 읽는다. */
    @Transactional(readOnly = true)
    public BookReadingSessionResponse findForBook(Long bookId) {
        return readingSessionBusiness.findForBook(bookId);
    }

    /** 읽기 전용 매퍼 경로로 세션 기억을 검색한다. */
    @Transactional(readOnly = true)
    public SessionSearchResponse search(String query) {
        return readingSessionBusiness.search(query);
    }

    /** 탐색 화면에 보여줄 공개 리뷰 카드를 읽는다. */
    @Transactional(readOnly = true)
    public PublicReviewListResponse findPublicReviews() {
        return readingSessionBusiness.findPublicReviews();
    }

    /** 현재 공개 상태인 리뷰의 댓글만 읽는다. */
    @Transactional(readOnly = true)
    public ReviewCommentListResponse findReviewComments(Long insightId) {
        return readingSessionBusiness.findReviewComments(insightId);
    }

    /** 공개 리뷰 댓글 또는 답글을 추가한다. */
    @Transactional
    public ReviewCommentListResponse createReviewComment(Long insightId, CreateReviewCommentRequest request) {
        return readingSessionBusiness.createReviewComment(insightId, request);
    }

    /** 댓글을 수정하고 새로고침된 스레드를 반환한다. */
    @Transactional
    public ReviewCommentListResponse updateReviewComment(Long insightId, Long commentId, UpdateReviewCommentRequest request) {
        return readingSessionBusiness.updateReviewComment(insightId, commentId, request);
    }

    /** 댓글을 소프트 삭제하고 새로고침된 스레드를 반환한다. */
    @Transactional
    public ReviewCommentListResponse deleteReviewComment(Long insightId, Long commentId) {
        return readingSessionBusiness.deleteReviewComment(insightId, commentId);
    }


    /** 사용자 목록에서 세션을 보관 처리한다. */
    @Transactional
    public void archive(Long sessionId) {
        readingSessionBusiness.archive(sessionId);
    }

    /** 세션 이름을 바꾸고 timeline을 반환한다. */
    @Transactional
    public ReadingSessionTimelineResponse updateTitle(Long sessionId, UpdateReadingSessionTitleRequest request) {
        return readingSessionBusiness.updateTitle(sessionId, request);
    }


    /** 세션에 인용문 또는 메모 하이라이트를 추가한다. */
    @Transactional
    public ReadingSessionTimelineResponse createHighlight(Long sessionId, CreateSessionHighlightRequest request) {
        return readingSessionBusiness.createHighlight(sessionId, request);
    }

    /** 인용문 또는 메모 하이라이트를 수정한다. */
    @Transactional
    public ReadingSessionTimelineResponse updateHighlight(Long sessionId, Long highlightId, UpdateSessionHighlightRequest request) {
        return readingSessionBusiness.updateHighlight(sessionId, highlightId, request);
    }

    /** 인용문 또는 메모 하이라이트를 소프트 삭제한다. */
    @Transactional
    public ReadingSessionTimelineResponse deleteHighlight(Long sessionId, Long highlightId) {
        return readingSessionBusiness.deleteHighlight(sessionId, highlightId);
    }

    /** 세션 태그를 추가한다. */
    @Transactional
    public ReadingSessionTimelineResponse createTag(Long sessionId, CreateSessionTagRequest request) {
        return readingSessionBusiness.createTag(sessionId, request);
    }

    /** 세션 태그를 소프트 삭제한다. */
    @Transactional
    public ReadingSessionTimelineResponse deleteTag(Long sessionId, Long tagId) {
        return readingSessionBusiness.deleteTag(sessionId, tagId);
    }

    /** 세션 인사이트 또는 공개 리뷰를 추가한다. */
    @Transactional
    public ReadingSessionTimelineResponse createInsight(Long sessionId, CreateSessionInsightRequest request) {
        return readingSessionBusiness.createInsight(sessionId, request);
    }

    /** 식별자는 유지하면서 세션 인사이트를 수정한다. */
    @Transactional
    public ReadingSessionTimelineResponse updateInsight(Long sessionId, Long insightId, UpdateSessionInsightRequest request) {
        return readingSessionBusiness.updateInsight(sessionId, insightId, request);
    }

    /** session 인사이트를 소프트 삭제한다. */
    @Transactional
    public ReadingSessionTimelineResponse deleteInsight(Long sessionId, Long insightId) {
        return readingSessionBusiness.deleteInsight(sessionId, insightId);
    }
}
