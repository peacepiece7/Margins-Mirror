package com.margins.session.business;

import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.business.ModerationBusiness;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.mapper.ModerationEventMapper;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.SaveQuestionAnswerRequest;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.ReflectionLoopProperties;
import com.margins.reflectionloop.business.ReflectionBusiness;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRequest;
import com.margins.session.dto.BookReadingSessionResponse;
import com.margins.session.dto.CreateReadingSessionRequest;
import com.margins.session.dto.CreateReadingSessionResponse;
import com.margins.session.dto.CreateReviewCommentRequest;
import com.margins.session.dto.CreateSessionInsightRequest;
import com.margins.session.dto.CreateSessionTagRequest;
import com.margins.session.dto.CreateSessionHighlightRequest;
import com.margins.session.dto.PublicReviewDto;
import com.margins.session.dto.PublicReviewListResponse;
import com.margins.session.dto.ReadingSessionNextActionDto;
import com.margins.session.dto.ReadingSessionStatsDto;
import com.margins.session.dto.ReadingSessionTimelineResponse;
import com.margins.session.dto.ReviewCommentDto;
import com.margins.session.dto.ReviewCommentListResponse;
import com.margins.session.dto.SessionSearchResponse;
import com.margins.session.dto.SessionSearchResultDto;
import com.margins.session.dto.SessionHighlightDto;
import com.margins.session.dto.SessionInsightDto;
import com.margins.session.dto.SessionMessageDto;
import com.margins.session.dto.SessionTagDto;
import com.margins.session.dto.SessionWindowTimelineDto;
import com.margins.session.dto.UpdateSessionHighlightRequest;
import com.margins.session.dto.UpdateSessionInsightRequest;
import com.margins.session.dto.UpdateReadingSessionTitleRequest;
import com.margins.session.dto.UpdateReviewCommentRequest;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.mapper.ReviewCommentMapper;
import com.margins.session.mapper.SessionHighlightMapper;
import com.margins.session.mapper.SessionInsightMapper;
import com.margins.session.mapper.SessionSearchMapper;
import com.margins.session.mapper.SessionTagMapper;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.mapper.SessionWindowPersonaMapper;
import com.margins.session.model.ReadingSessionRecord;
import com.margins.session.model.PublicReviewRecord;
import com.margins.session.model.ReviewCommentRecord;
import com.margins.session.model.SessionHighlightRecord;
import com.margins.session.model.SessionInsightRecord;
import com.margins.session.model.SessionSearchResultRecord;
import com.margins.session.model.SessionTagRecord;
import com.margins.session.model.SessionWindowRecord;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 독서 세션 도메인의 핵심 업무 규칙을 처리한다.
 * 책-대화 session mapping, 타임라인, 검색, 태그, 리뷰/하이라이트/인사이트 흐름을 조율한다.
 */
@Component
@RequiredArgsConstructor
public class ReadingSessionBusiness {
    private static final String QUESTION_ANSWER_INSIGHT_TYPE = "question_answer";

    /** 모든 세션 조회와 변경에서 인증된 독자를 확인한다. */
    private long currentUserId() {
        return AuthContext.requireUserId();
    }
    private final ReadingSessionMapper readingSessionMapper;
    private final SessionWindowMapper sessionWindowMapper;
    private final SessionHighlightMapper sessionHighlightMapper;
    private final SessionInsightMapper sessionInsightMapper;
    private final ReviewCommentMapper reviewCommentMapper;
    private final SessionSearchMapper sessionSearchMapper;
    private final SessionTagMapper sessionTagMapper;
    private final MessageMapper messageMapper;
    private final QuestionMapper questionMapper;
    private SessionWindowPersonaMapper sessionWindowPersonaMapper;
    private ModerationEventMapper moderationEventMapper;
    private ModerationBusiness moderationBusiness;
    private ReflectionBusiness reflectionBusiness;
    private ReflectionLoopProperties reflectionLoopProperties;

    @Autowired
    void configureModeration(
        ModerationEventMapper moderationEventMapper,
        ModerationBusiness moderationBusiness
    ) {
        this.moderationEventMapper = moderationEventMapper;
        this.moderationBusiness = moderationBusiness;
    }

    @Autowired
    public void configureSessionWindowPersonaMapper(SessionWindowPersonaMapper mapper) {
        this.sessionWindowPersonaMapper = mapper;
    }

    @Autowired(required = false)
    void configureReflectionLoop(
        ReflectionBusiness reflectionBusiness,
        ReflectionLoopProperties reflectionLoopProperties
    ) {
        this.reflectionBusiness = reflectionBusiness;
        this.reflectionLoopProperties = reflectionLoopProperties;
    }

    /** 책 저장 이후 commit된 이벤트에서 호출되어 기존 session을 먼저 선택하거나 만든다. */
    public ReadingSessionRecord ensureForBook(Long bookId, Long userId) {
        ReadingSessionRecord existing = readingSessionMapper.findFirstByBookIdAndUserId(bookId, userId);
        if (existing != null) {
            return existing;
        }
        if (readingSessionMapper.countActiveBookById(bookId, userId) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book not found");
        }
        ReadingSessionRecord record = ReadingSessionRecord.builder()
            .userId(userId)
            .bookId(bookId)
            .title("Book " + bookId + " reflection")
            .testData(readingSessionMapper.findBookTestData(bookId, userId))
            .build();
        requireInserted(readingSessionMapper.insert(record), "Reading session could not be saved");
        return record;
    }

    /** 현재 사용자가 소유한 책에 대해서만 수동 세션을 만든다. */
    public CreateReadingSessionResponse create(CreateReadingSessionRequest request) {
        if (readingSessionMapper.countActiveBookById(request.getBookId(), currentUserId()) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book not found");
        }

        ReadingSessionRecord record = ReadingSessionRecord.builder()
            .userId(currentUserId())
            .bookId(request.getBookId())
            .title(request.getTitle())
            .testData(true)
            .build();

        requireInserted(readingSessionMapper.insert(record), "Reading session could not be saved");

        return CreateReadingSessionResponse.builder()
            .sessionId(record.getId())
            .bookId(record.getBookId())
            .title(record.getTitle())
            .build();
    }

    /** 가장 최근에 접근한 세션을 기본 작업 공간 진입점으로 복원한다. */
    public ReadingSessionTimelineResponse findLatestTimeline() {
        ReadingSessionRecord session = readingSessionMapper.findLatestByUserId(currentUserId());
        return toTimeline(session);
    }

    /** 매퍼에서 현재 사용자 소유권을 강제하며 세션 timeline 하나를 복원한다. */
    public ReadingSessionTimelineResponse findTimeline(Long sessionId) {
        return toTimeline(readingSessionMapper.findByIdAndUserId(sessionId, currentUserId()));
    }

    /** 접근 가능한 책의 최신 세션을 식별자와 표시 제목으로만 투영한다. */
    public BookReadingSessionResponse findForBook(Long bookId) {
        ReadingSessionRecord session = readingSessionMapper.findFirstByBookIdAndUserId(bookId, currentUserId());
        if (session == null) {
            return null;
        }
        return BookReadingSessionResponse.builder()
            .sessionId(session.getId())
            .title(session.getTitle())
            .build();
    }

    /** 저장된 세션 기억을 검색하고 빈 검색어에는 빈 결과를 반환한다. */
    public SessionSearchResponse search(String query) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isEmpty()) {
            return SessionSearchResponse.builder()
                .query("")
                .results(List.of())
                .build();
        }

        return SessionSearchResponse.builder()
            .query(normalizedQuery)
            .results(sessionSearchMapper.search(currentUserId(), normalizedQuery, 30)
                .stream()
                .map(this::toSearchResultDto)
                .toList())
            .build();
    }

    /** 비공개 또는 삭제된 인사이트를 노출하지 않고 탐색용 공개 리뷰를 나열한다. */
    public PublicReviewListResponse findPublicReviews() {
        return PublicReviewListResponse.builder()
            .reviews(sessionInsightMapper.findPublicReviews(30)
                .stream()
                .map(this::toPublicReviewDto)
                .toList())
            .build();
    }

    /** 보이는 댓글 스레드를 반환하기 전에 리뷰가 여전히 공개 상태인지 확인한다. */
    public ReviewCommentListResponse findReviewComments(Long insightId) {
        requirePublicReview(insightId);
        return reviewCommentsResponse(insightId);
    }

    /** 공개 리뷰 인사이트에 최상위 댓글 또는 한 단계 답글을 추가한다. */
    public ReviewCommentListResponse createReviewComment(Long insightId, CreateReviewCommentRequest request) {
        requirePublicReview(insightId);
        if (request.getParentCommentId() != null && reviewCommentMapper.countActiveParent(insightId, request.getParentCommentId()) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Parent review comment not found");
        }

        ReviewCommentRecord record = ReviewCommentRecord.builder()
            .insightId(insightId)
            .userId(currentUserId())
            .parentCommentId(request.getParentCommentId())
            .content(request.getContent().trim())
            .testData(true)
            .build();
        requireInserted(reviewCommentMapper.insert(record), "Review comment could not be saved");
        return reviewCommentsResponse(insightId);
    }

    /** 현재 사용자가 소유한 댓글만 수정한 뒤 스레드를 다시 복원한다. */
    public ReviewCommentListResponse updateReviewComment(Long insightId, Long commentId, UpdateReviewCommentRequest request) {
        requirePublicReview(insightId);
        requireUpdated(
            reviewCommentMapper.updateContent(insightId, commentId, currentUserId(), request.getContent().trim()),
            "Review comment not found"
        );
        return reviewCommentsResponse(insightId);
    }

    /** 매퍼를 통해 댓글 분기를 소프트 삭제하고 남은 보이는 스레드를 반환한다. */
    public ReviewCommentListResponse deleteReviewComment(Long insightId, Long commentId) {
        requirePublicReview(insightId);
        requireUpdated(reviewCommentMapper.softDelete(insightId, commentId, currentUserId()), "Review comment not found");
        return reviewCommentsResponse(insightId);
    }


    /** 감사용 연결 레코드는 보존하면서 사용자 목록에서 세션을 보관 처리한다. */
    public void archive(Long sessionId) {
        requireUpdated(readingSessionMapper.softDelete(sessionId, currentUserId()));
    }

    /** 독자에게 보이는 세션 제목을 바꾸고 수정된 timeline을 반환한다. */
    public ReadingSessionTimelineResponse updateTitle(Long sessionId, UpdateReadingSessionTitleRequest request) {
        requireUpdated(readingSessionMapper.updateTitle(sessionId, currentUserId(), request.getTitle()));
        return findTimeline(sessionId);
    }


    /** 세션 timeline 안에 인용문 또는 메모를 지속 가능한 리뷰 근거로 저장한다. */
    public ReadingSessionTimelineResponse createHighlight(Long sessionId, CreateSessionHighlightRequest request) {
        ReadingSessionRecord session = requireSession(sessionId);

        SessionHighlightRecord record = SessionHighlightRecord.builder()
            .sessionId(session.getId())
            .bookId(session.getBookId())
            .userId(currentUserId())
            .pageNumber(request.getPageNumber())
            .locationLabel(request.getLocationLabel())
            .quoteText(request.getQuoteText())
            .note(request.getNote())
            .highlightOrder(sessionHighlightMapper.selectNextOrder(session.getId()))
            .testData(true)
            .build();

        requireInserted(sessionHighlightMapper.insert(record), "Session highlight could not be saved");
        return findTimeline(sessionId);
    }

    /** 식별자와 timeline 순서를 바꾸지 않고 저장된 구절을 수정한다. */
    public ReadingSessionTimelineResponse updateHighlight(Long sessionId, Long highlightId, UpdateSessionHighlightRequest request) {
        requireSession(sessionId);

        requireUpdated(sessionHighlightMapper.update(
            sessionId,
            highlightId,
            currentUserId(),
            request.getPageNumber(),
            request.getLocationLabel(),
            request.getQuoteText(),
            request.getNote()
        ), "Session highlight not found");
        return findTimeline(sessionId);
    }

    /** 감사 행은 유지하면서 저장된 구절을 사용자 조회에서 숨긴다. */
    public ReadingSessionTimelineResponse deleteHighlight(Long sessionId, Long highlightId) {
        requireSession(sessionId);

        requireUpdated(sessionHighlightMapper.softDelete(sessionId, highlightId, currentUserId()), "Session highlight not found");
        return findTimeline(sessionId);
    }

    /** library 정리를 위해 세션에 독자 라벨을 붙인다. */
    public ReadingSessionTimelineResponse createTag(Long sessionId, CreateSessionTagRequest request) {
        requireSession(sessionId);

        SessionTagRecord record = SessionTagRecord.builder()
            .sessionId(sessionId)
            .userId(currentUserId())
            .label(request.getLabel().trim())
            .testData(true)
            .build();
        requireInserted(sessionTagMapper.insert(record), "Session tag could not be saved");
        return findTimeline(sessionId);
    }

    /** 과거 세션 데이터가 유지되도록 태그를 소프트 삭제한다. */
    public ReadingSessionTimelineResponse deleteTag(Long sessionId, Long tagId) {
        requireSession(sessionId);
        requireUpdated(sessionTagMapper.softDelete(sessionId, tagId, currentUserId()), "Session tag not found");
        return findTimeline(sessionId);
    }

    /** 선택적 공개 여부와 함께 독자가 정리한 리뷰 또는 takeaway를 저장한다. */
    public ReadingSessionTimelineResponse createInsight(Long sessionId, CreateSessionInsightRequest request) {
        requireSession(sessionId);
        rejectReservedQuestionAnswerType(request.getInsightType());
        if (reflectionLoopEnabled() && "reflection".equals(normalizeInsightType(request.getInsightType()))) {
            reflectionBusiness.createLegacy(sessionId, toReflectionRequest(
                request.getContent(),
                request.getTitle(),
                request.getEvidence(),
                request.getAuthorName(),
                request.getVisibility(),
                request.getReviewedOn()
            ));
            return findTimeline(sessionId);
        }

        SessionInsightRecord record = SessionInsightRecord.builder()
            .sessionId(sessionId)
            .userId(currentUserId())
            .insightType(normalizeInsightType(request.getInsightType()))
            .title(trimToNull(request.getTitle()))
            .content(request.getContent().trim())
            .evidence(trimToNull(request.getEvidence()))
            .authorName(trimToNull(request.getAuthorName()))
            .visibility(normalizeVisibility(request.getVisibility()))
            .reviewedOn(parseDate(request.getReviewedOn()))
            .insightOrder(sessionInsightMapper.selectNextOrder(sessionId))
            .testData(true)
            .build();
        requireInserted(sessionInsightMapper.insert(record), "Session insight could not be saved");
        return findTimeline(sessionId);
    }

    /** 댓글이 같은 인사이트 식별자를 계속 참조하도록 리뷰/takeaway를 제자리에서 수정한다. */
    public ReadingSessionTimelineResponse updateInsight(Long sessionId, Long insightId, UpdateSessionInsightRequest request) {
        requireSession(sessionId);
        SessionInsightRecord existing = sessionInsightMapper.findActiveById(
            sessionId,
            insightId,
            currentUserId()
        );
        if (existing == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Session insight not found");
        }
        if (existing.getQuestionId() != null) {
            throw new ApiException(ApiErrorCode.SESSION_QUESTION_ANSWER_ROUTE_REQUIRED);
        }
        rejectReservedQuestionAnswerType(request.getInsightType());
        if (reflectionLoopEnabled()) {
            String targetType = normalizeInsightType(request.getInsightType());
            if ("reflection".equals(existing.getInsightType()) && !"reflection".equals(targetType)) {
                throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Primary Reflection type cannot be changed");
            }
            if ("reflection".equals(targetType)) {
                reflectionBusiness.updateLegacy(sessionId, insightId, toReflectionRequest(
                    request.getContent(),
                    request.getTitle(),
                    request.getEvidence(),
                    request.getAuthorName(),
                    request.getVisibility(),
                    request.getReviewedOn()
                ));
                return findTimeline(sessionId);
            }
        }

        requireUpdated(sessionInsightMapper.update(
            sessionId,
            insightId,
            currentUserId(),
            normalizeInsightType(request.getInsightType()),
            trimToNull(request.getTitle()),
            request.getContent().trim(),
            trimToNull(request.getEvidence()),
            trimToNull(request.getAuthorName()),
            normalizeVisibility(request.getVisibility()),
            parseDate(request.getReviewedOn())
        ), "Session insight not found");
        return findTimeline(sessionId);
    }

    private boolean reflectionLoopEnabled() {
        return reflectionBusiness != null
            && reflectionLoopProperties != null
            && reflectionLoopProperties.isEnabled();
    }

    private SaveReflectionRequest toReflectionRequest(
        String content,
        String title,
        String evidence,
        String authorName,
        String visibility,
        String reviewedOn
    ) {
        return SaveReflectionRequest.builder()
            .content(content)
            .title(title)
            .evidence(evidence)
            .authorName(authorName)
            .visibility(visibility)
            .reviewedOn(reviewedOn)
            .build();
    }

    /** 질문별 대표 답변 하나를 비공개 insight로 생성하거나 제자리에서 수정한다. */
    public ReadingSessionTimelineResponse saveQuestionAnswer(
        Long questionId,
        SaveQuestionAnswerRequest request
    ) {
        QuestionRecord question = questionMapper.findActiveById(questionId, currentUserId());
        if (question == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Question not found");
        }

        String content = request.getContent().trim();
        SessionInsightRecord existing = sessionInsightMapper.findActiveByQuestionId(
            questionId,
            currentUserId()
        );
        if (existing == null) {
            SessionInsightRecord record = SessionInsightRecord.builder()
                .sessionId(question.getSessionId())
                .userId(currentUserId())
                .questionId(questionId)
                .insightType(QUESTION_ANSWER_INSIGHT_TYPE)
                .content(content)
                .visibility("PRIVATE")
                .insightOrder(sessionInsightMapper.selectNextOrder(question.getSessionId()))
                .testData(true)
                .build();
            requireInserted(sessionInsightMapper.insert(record), "Question answer could not be saved");
        } else {
            requireUpdated(
                sessionInsightMapper.updateQuestionAnswer(questionId, currentUserId(), content),
                "Question answer not found"
            );
        }
        return findTimeline(question.getSessionId());
    }

    /** 의존 이력은 삭제하지 않고 인사이트를 timeline과 공개 리뷰 목록에서 숨긴다. */
    public ReadingSessionTimelineResponse deleteInsight(Long sessionId, Long insightId) {
        requireSession(sessionId);
        requireUpdated(sessionInsightMapper.softDelete(sessionId, insightId, currentUserId()), "Session insight not found");
        return findTimeline(sessionId);
    }

    /** 세션, 윈도우, 메시지, 메모, 태그, 질문으로 전체 작업 공간 payload를 구성한다. */
    private ReadingSessionTimelineResponse toTimeline(ReadingSessionRecord session) {
        if (session == null) {
            return null;
        }

        List<SessionWindowTimelineDto> windows = sessionWindowMapper.findBySessionId(session.getId())
            .stream()
            .map(this::toWindowDto)
            .toList();
        List<SessionMessageDto> messages = messageMapper.findBySessionId(session.getId())
            .stream()
            .map(this::toMessageDto)
            .toList();
        List<SessionHighlightDto> highlights = sessionHighlightMapper.findBySessionId(session.getId())
            .stream()
            .map(this::toHighlightDto)
            .toList();
        List<SessionTagDto> tags = sessionTagMapper.findBySessionId(session.getId(), currentUserId())
            .stream()
            .map(this::toTagDto)
            .toList();
        List<SessionInsightDto> insights = sessionInsightMapper.findBySessionId(session.getId(), currentUserId())
            .stream()
            .map(this::toInsightDto)
            .toList();
        List<QuestionDto> questions = questionMapper.findBySessionId(session.getId())
            .stream()
            .map(this::toQuestionDto)
            .toList();
        List<ModerationEventDto> moderationEvents = moderationEventMapper == null
            ? List.of()
            : moderationEventMapper.findTimelineBySessionIdAndUserId(session.getId(), currentUserId())
                .stream()
                .map(moderationBusiness::toDto)
                .toList();

        ReadingSessionStatsDto stats = toStats(windows, questions, messages, insights);

        return ReadingSessionTimelineResponse.builder()
            .sessionId(session.getId())
            .bookId(session.getBookId())
            .bookTitle(session.getBookTitle())
            .bookAuthor(session.getBookAuthor())
            .title(session.getTitle())
            .stats(stats)
            .nextActions(toNextActions(
                session,
                windows,
                questions,
                messages,
                insights,
                highlights,
                stats
            ))
            .windows(windows)
            .highlights(highlights)
            .tags(tags)
            .insights(insights)
            .questions(questions)
            .messages(messages)
            .moderationEvents(moderationEvents)
            .build();
    }

    /** 누락된 진행도, 열린 질문, 근거, 토론 상태를 바탕으로 다음 독자 행동을 제안한다. */
    private List<ReadingSessionNextActionDto> toNextActions(
        ReadingSessionRecord session,
        List<SessionWindowTimelineDto> windows,
        List<QuestionDto> questions,
        List<SessionMessageDto> messages,
        List<SessionInsightDto> insights,
        List<SessionHighlightDto> highlights,
        ReadingSessionStatsDto stats
    ) {
        List<ReadingSessionNextActionDto> actions = new java.util.ArrayList<>();
        Long questionWindowId = windows.stream()
            .filter((window) -> "question".equals(window.getWindowType()))
            .map(SessionWindowTimelineDto::getWindowId)
            .findFirst()
            .orElse(windows.isEmpty() ? null : windows.get(0).getWindowId());
        Long debateWindowId = windows.stream()
            .filter((window) -> "debate".equals(window.getWindowType()))
            .map(SessionWindowTimelineDto::getWindowId)
            .findFirst()
            .orElse(null);


        QuestionDto openQuestion = firstOpenQuestion(questions, messages, insights);
        if (questions.isEmpty()) {
            actions.add(nextAction(
                "generate_questions",
                "Generate reflection questions",
                "Create prompts for the current reflection window before writing answers.",
                questionWindowId,
                null
            ));
        } else if (openQuestion != null) {
            actions.add(nextAction(
                "answer_open_question",
                "Answer an open question",
                openQuestion.getQuestionText(),
                openQuestion.getWindowId(),
                openQuestion.getQuestionId()
            ));
        }

        if (highlights.isEmpty()) {
            actions.add(nextAction(
                "save_highlight",
                "Save a quote",
                "Capture a passage or note so the review has evidence.",
                null,
                null
            ));
        }

        if (stats.getPersonaResponseCount() == null || stats.getPersonaResponseCount() == 0) {
            actions.add(nextAction(
                "ask_persona",
                "Ask a persona",
                "Send one interpretation to the debate window for another perspective.",
                debateWindowId,
                null
            ));
        }


        return actions;
    }

    /** 영향 행이 없는 변경을 비즈니스 경계에서 API 404/500 의미로 변환한다. */
    private void requireUpdated(int updatedRows) {
        requireUpdated(updatedRows, "Reading session not found");
    }

    private void requireUpdated(int updatedRows, String reason) {
        if (updatedRows <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, reason);
        }
    }

    private void requireInserted(int insertedRows, String reason) {
        if (insertedRows <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
        }
    }

    /** 하위 레코드를 변경하기 전에 소유권 검사를 포함해 세션을 조회한다. */
    private ReadingSessionRecord requireSession(Long sessionId) {
        ReadingSessionRecord session = readingSessionMapper.findByIdAndUserId(sessionId, currentUserId());
        if (session == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reading session not found");
        }

        return session;
    }

    /** 비공개 또는 삭제된 인사이트에는 공개 리뷰 댓글 작업을 막는다. */
    private void requirePublicReview(Long insightId) {
        if (reviewCommentMapper.countPublicReview(insightId) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Public review not found");
        }
    }

    /** 댓글 변경 뒤마다 댓글 스레드 하나를 다시 복원한다. */
    private ReviewCommentListResponse reviewCommentsResponse(Long insightId) {
        return ReviewCommentListResponse.builder()
            .insightId(insightId)
            .comments(reviewCommentMapper.findByInsightId(insightId)
                .stream()
                .map(this::toReviewCommentDto)
                .toList())
            .build();
    }

    /** 사용자 메시지와 question id를 비교해 첫 미답변 프롬프트를 찾는다. */
    private QuestionDto firstOpenQuestion(
        List<QuestionDto> questions,
        List<SessionMessageDto> messages,
        List<SessionInsightDto> insights
    ) {
        java.util.Set<Long> answeredQuestionIds = messages.stream()
            .filter((message) -> "user".equals(message.getRole()))
            .map(SessionMessageDto::getQuestionId)
            .filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toSet());
        insights.stream()
            .filter((insight) -> QUESTION_ANSWER_INSIGHT_TYPE.equals(insight.getInsightType()))
            .map(SessionInsightDto::getQuestionId)
            .filter(Objects::nonNull)
            .forEach(answeredQuestionIds::add);

        return questions.stream()
            .filter((question) -> !answeredQuestionIds.contains(question.getQuestionId()))
            .findFirst()
            .orElse(null);
    }

    /** 작업 공간 UI가 바로 소비하는 다음 행동 descriptor 하나를 만든다. */
    private ReadingSessionNextActionDto nextAction(
        String actionId,
        String label,
        String detail,
        Long targetWindowId,
        Long targetQuestionId
    ) {
        return ReadingSessionNextActionDto.builder()
            .actionId(actionId)
            .label(label)
            .detail(detail)
            .targetWindowId(targetWindowId)
            .targetQuestionId(targetQuestionId)
            .build();
    }

    /** 응답 내부 일관성을 유지하도록 로드된 timeline 행에서 세션 통계를 계산한다. */
    private ReadingSessionStatsDto toStats(
        List<SessionWindowTimelineDto> windows,
        List<QuestionDto> questions,
        List<SessionMessageDto> messages,
        List<SessionInsightDto> insights
    ) {
        java.util.Set<Long> answeredQuestionIds = messages.stream()
            .filter((message) -> "user".equals(message.getRole()))
            .map(SessionMessageDto::getQuestionId)
            .filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toSet());
        insights.stream()
            .filter((insight) -> QUESTION_ANSWER_INSIGHT_TYPE.equals(insight.getInsightType()))
            .map(SessionInsightDto::getQuestionId)
            .filter(Objects::nonNull)
            .forEach(answeredQuestionIds::add);
        long personaResponses = messages.stream()
            .filter((message) -> message.getPersonaId() != null)
            .count();
        long personas = messages.stream()
            .map(SessionMessageDto::getPersonaId)
            .filter(Objects::nonNull)
            .distinct()
            .count();

        return ReadingSessionStatsDto.builder()
            .windowCount(windows.size())
            .questionCount(questions.size())
            .answeredQuestionCount(answeredQuestionIds.size())
            .messageCount(messages.size())
            .personaResponseCount((int) personaResponses)
            .personaCount((int) personas)
            .build();
    }

    /** 리뷰/takeaway 행에서 쓰는 현재 기본값으로 인사이트 유형을 정규화한다. */
    private String normalizeInsightType(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? "takeaway" : trimmed;
    }

    /** 리뷰가 가능한 인사이트의 공개/비공개 여부를 정규화한다. */
    private String normalizeVisibility(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? "PRIVATE" : trimmed.toUpperCase(java.util.Locale.ROOT);
    }

    /** 잘못된 입력에는 클라이언트용 검증 오류를 반환하면서 선택 리뷰 날짜를 파싱한다. */
    private java.time.LocalDate parseDate(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }

        try {
            return java.time.LocalDate.parse(trimmed);
        } catch (java.time.format.DateTimeParseException exception) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "reviewedOn must be a valid date");
        }
    }

    /** 조회 필터가 빈 문자열 검사를 하지 않도록 선택 텍스트의 빈 값은 null로 저장한다. */
    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    /** 저장된 윈도우 행을 timeline 윈도우 DTO로 매핑한다. */
    private SessionWindowTimelineDto toWindowDto(SessionWindowRecord record) {
        return SessionWindowTimelineDto.builder()
            .windowId(record.getId())
            .sessionId(record.getSessionId())
            .sourceQuestionId(record.getSourceQuestionId())
            .windowType(record.getWindowType())
            .title(record.getTitle())
            .position(record.getPosition())
            .status(record.getStatus())
            .personaIds(sessionWindowPersonaMapper == null ? List.of() : sessionWindowPersonaMapper.findPersonaIds(record.getId()))
            .build();
    }

    /** 저장된 메시지 행을 timeline 메시지 DTO로 매핑한다. */
    private SessionMessageDto toMessageDto(MessageRecord record) {
        return SessionMessageDto.builder()
            .messageId(record.getId())
            .sessionId(record.getSessionId())
            .windowId(record.getWindowId())
            .parentMessageId(record.getParentMessageId())
            .role(record.getRole())
            .content(record.getContent())
            .messageOrder(record.getMessageOrder())
            .aiModel(record.getAiModel())
            .personaId(record.getPersonaId())
            .questionId(record.getQuestionId())
            .streamingStatus(record.getStreamingStatus())
            .createdAt(record.getCreatedAt())
            .build();
    }

    /** 하이라이트 행을 timeline 근거 DTO로 매핑한다. */
    private SessionHighlightDto toHighlightDto(SessionHighlightRecord record) {
        return SessionHighlightDto.builder()
            .highlightId(record.getId())
            .sessionId(record.getSessionId())
            .bookId(record.getBookId())
            .pageNumber(record.getPageNumber())
            .locationLabel(record.getLocationLabel())
            .quoteText(record.getQuoteText())
            .note(record.getNote())
            .highlightOrder(record.getHighlightOrder())
            .build();
    }

    /** 세션 태그 행을 timeline 태그 DTO로 매핑한다. */
    private SessionTagDto toTagDto(SessionTagRecord record) {
        return SessionTagDto.builder()
            .tagId(record.getId())
            .sessionId(record.getSessionId())
            .label(record.getLabel())
            .build();
    }

    /** 인사이트 행을 timeline 인사이트/리뷰 DTO로 매핑한다. */
    private SessionInsightDto toInsightDto(SessionInsightRecord record) {
        return SessionInsightDto.builder()
            .insightId(record.getId())
            .sessionId(record.getSessionId())
            .questionId(record.getQuestionId())
            .insightType(record.getInsightType())
            .title(record.getTitle())
            .content(record.getContent())
            .evidence(record.getEvidence())
            .authorName(record.getAuthorName())
            .visibility(record.getVisibility())
            .reviewedOn(record.getReviewedOn() == null ? null : record.getReviewedOn().toString())
            .createdAt(record.getCreatedAt() == null ? null : record.getCreatedAt().toString())
            .updatedAt(record.getUpdatedAt() == null ? null : record.getUpdatedAt().toString())
            .insightOrder(record.getInsightOrder())
            .build();
    }

    private void rejectReservedQuestionAnswerType(String insightType) {
        if (QUESTION_ANSWER_INSIGHT_TYPE.equalsIgnoreCase(
            insightType == null ? "" : insightType.trim()
        )) {
            throw new ApiException(
                ApiErrorCode.SESSION_QUESTION_ANSWER_TYPE_INVALID,
                "Question answers must use the question answer endpoint"
            );
        }
    }

    /** 공개 리뷰 조회 행을 탐색 카드 DTO로 매핑한다. */
    private PublicReviewDto toPublicReviewDto(PublicReviewRecord record) {
        return PublicReviewDto.builder()
            .insightId(record.getInsightId())
            .sessionId(record.getSessionId())
            .bookId(record.getBookId())
            .bookTitle(record.getBookTitle())
            .bookAuthor(record.getBookAuthor())
            .sessionTitle(record.getSessionTitle())
            .title(record.getTitle())
            .content(record.getContent())
            .evidence(record.getEvidence())
            .authorName(record.getAuthorName())
            .reviewedOn(record.getReviewedOn() == null ? null : record.getReviewedOn().toString())
            .createdAt(record.getCreatedAt() == null ? null : record.getCreatedAt().toString())
            .updatedAt(record.getUpdatedAt() == null ? null : record.getUpdatedAt().toString())
            .build();
    }

    /** 리뷰 댓글 행을 평면 스레드 DTO로 매핑한다. */
    private ReviewCommentDto toReviewCommentDto(ReviewCommentRecord record) {
        return ReviewCommentDto.builder()
            .commentId(record.getId())
            .insightId(record.getInsightId())
            .parentCommentId(record.getParentCommentId())
            .authorName(record.getAuthorName())
            .content(record.getContent())
            .ownedByCurrentReader(record.getUserId() != null && record.getUserId().longValue() == currentUserId())
            .createdAt(record.getCreatedAt() == null ? null : record.getCreatedAt().toString())
            .updatedAt(record.getUpdatedAt() == null ? null : record.getUpdatedAt().toString())
            .build();
    }

    /** 검색 결과 행을 프론트엔드 기억 검색 DTO로 매핑한다. */
    private SessionSearchResultDto toSearchResultDto(SessionSearchResultRecord record) {
        return SessionSearchResultDto.builder()
            .sessionId(record.getSessionId())
            .sourceId(record.getSourceId())
            .resultType(record.getResultType())
            .bookTitle(record.getBookTitle())
            .sessionTitle(record.getSessionTitle())
            .snippet(record.getSnippet())
            .build();
    }

    /** 질문 행을 timeline 질문 DTO로 매핑한다. */
    private QuestionDto toQuestionDto(QuestionRecord record) {
        return QuestionDto.builder()
            .questionId(record.getId())
            .sessionId(record.getSessionId())
            .windowId(record.getWindowId())
            .questionText(record.getQuestionText())
            .questionType(record.getQuestionType())
            .aiModel(record.getAiModel())
            .build();
    }
}
