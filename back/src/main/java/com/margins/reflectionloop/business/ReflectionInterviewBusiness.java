package com.margins.reflectionloop.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.ReflectionLoopProperties;
import com.margins.reflectionloop.ai.ReflectionQuestionGenerator;
import com.margins.reflectionloop.ai.ReflectionQuestionGenerator.EvidenceDraft;
import com.margins.reflectionloop.ai.ReflectionQuestionGenerator.QuestionDraft;
import com.margins.reflectionloop.business.ReflectionEvidenceCatalog.Source;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.ReflectionInterviewAnswerRecord;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.reflectionloop.model.dto.request.InterviewResponseRequest;
import com.margins.reflectionloop.model.dto.request.UpdateInterviewAnswerRequest;
import com.margins.reflectionloop.model.dto.response.InterviewAnswerDto;
import com.margins.reflectionloop.model.dto.response.InterviewQuestionDto;
import com.margins.reflectionloop.model.dto.response.ReflectionInterviewResponse;
import com.margins.session.mapper.SessionInsightMapper;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.SessionInsightRecord;
import com.margins.session.model.SessionWindowRecord;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
public class ReflectionInterviewBusiness {
    public static final int MINIMUM_ANSWERS = 3;
    public static final int TARGET_ANSWERS = 5;
    public static final int MAXIMUM_QUESTIONS = 7;
    private static final List<String> COVERAGE_SEQUENCE = List.of(
        "FIRST_IMPRESSION",
        "TEXTUAL_INTERPRETATION",
        "PERSONAL_RESPONSE",
        "ALTERNATIVE_VIEW",
        "SOCIAL_VALUE",
        "REFLECTION_FOCUS",
        "ALTERNATIVE_VIEW"
    );

    private final ReflectionBusiness reflectionBusiness;
    private final ReflectionLoopProperties properties;
    private final ReflectionRevisionMapper reflectionRevisionMapper;
    private final ReflectionInterviewMapper reflectionInterviewMapper;
    private final DiscussionGuideMapper discussionGuideMapper;
    private final SessionWindowMapper sessionWindowMapper;
    private final SessionInsightMapper sessionInsightMapper;
    private final QuestionMapper questionMapper;
    private final ReflectionQuestionGenerator questionGenerator;
    private final ReflectionEvidenceCatalog evidenceCatalog;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public ReflectionInterviewResponse start(Long reflectionId) {
        StartResult started = transactionTemplate.execute(status -> startInTransaction(reflectionId));
        if (started == null) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Interview could not be started");
        }
        if (started.created()) {
            generateAndPersistNextQuestion(started.interviewId(), false, null);
        }
        return response(requireInterview(started.interviewId()));
    }

    private StartResult startInTransaction(Long reflectionId) {
        reflectionBusiness.requireEnabled();
        SessionInsightRecord reflection = reflectionBusiness.requirePrimaryReflectionForUpdate(reflectionId);
        ReflectionRevisionRecord revision = reflectionBusiness.currentRevision(reflectionId);
        ReflectionInterviewRecord interview = reflectionInterviewMapper.findActiveInterviewByRevision(
            revision.getId(),
            currentUserId()
        );
        if (interview == null) {
            SessionWindowRecord window = ensureReflectionWindow(reflection);
            interview = ReflectionInterviewRecord.builder()
                .reflectionInsightId(reflectionId)
                .sourceRevisionId(revision.getId())
                .sessionId(reflection.getSessionId())
                .windowId(window.getId())
                .userId(currentUserId())
                .status("ACTIVE")
                .coverageJson("[]")
                .answeredCount(0)
                .skippedCount(0)
                .generatedCount(0)
                .promptVersion(properties.getInterviewPromptVersion())
                .testData(reflection.isTestData())
                .build();
            requireChanged(reflectionInterviewMapper.insertInterview(interview), "Interview could not be saved");
            return new StartResult(interview.getId(), true);
        }
        return new StartResult(interview.getId(), false);
    }

    public ReflectionInterviewResponse get(Long interviewId) {
        reflectionBusiness.requireEnabled();
        return response(requireInterview(interviewId));
    }

    public ReflectionInterviewResponse respond(Long interviewId, InterviewResponseRequest request) {
        ResponseResult result = transactionTemplate.execute(
            status -> respondInTransaction(interviewId, request)
        );
        if (result == null) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Interview response could not be saved");
        }
        if (result.generateNext()) {
            generateAndPersistNextQuestion(
                interviewId,
                result.bookOnly(),
                result.replacementCoverage()
            );
        }
        return response(requireInterview(interviewId));
    }

    public ReflectionInterviewResponse updateAnswer(
        Long interviewId,
        Long questionId,
        UpdateInterviewAnswerRequest request
    ) {
        AnswerUpdateResult result = transactionTemplate.execute(
            status -> updateAnswerInTransaction(interviewId, questionId, request)
        );
        if (result == null) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Interview answer could not be updated");
        }
        if (result.generateNext()) {
            generateAndPersistNextQuestion(result.interviewId(), false, null);
        }
        return response(requireInterview(result.interviewId()));
    }

    private AnswerUpdateResult updateAnswerInTransaction(
        Long interviewId,
        Long questionId,
        UpdateInterviewAnswerRequest request
    ) {
        reflectionBusiness.requireEnabled();
        ReflectionInterviewRecord interview = requireInterviewForUpdate(interviewId);
        if ("ABANDONED".equals(interview.getStatus())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview lineage is no longer active");
        }
        QuestionRecord question = reflectionInterviewMapper.findOwnedInterviewQuestion(
            interviewId,
            questionId,
            currentUserId()
        );
        if (question == null || !"answered".equals(question.getStatus())
            || !"ANSWER".equals(question.getResponseMode())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Only an answered interview question can be edited");
        }
        ReflectionInterviewAnswerRecord current = reflectionInterviewMapper.findCurrentAnswerForUpdate(
            interviewId,
            questionId,
            currentUserId()
        );
        if (current == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Interview answer not found");
        }
        if (current.getVersion() == null
            || current.getVersion().longValue() != request.getExpectedAnswerVersion()) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview answer changed; reload before editing");
        }

        String content = request.getContent().trim();
        if ("WORDING_ONLY".equals(request.getRevisionKind())) {
            appendAnswerRevision(
                interview,
                question,
                current,
                content,
                "WORDING_ONLY",
                current.getSessionInsightId()
            );
            return new AnswerUpdateResult(interviewId, false);
        }

        ReflectionInterviewRecord fork = forkFromAnswer(
            interview,
            question,
            current,
            content
        );
        return new AnswerUpdateResult(
            fork.getId(),
            fork.getGeneratedCount() < MAXIMUM_QUESTIONS
        );
    }

    private ResponseResult respondInTransaction(
        Long interviewId,
        InterviewResponseRequest request
    ) {
        reflectionBusiness.requireEnabled();
        ReflectionInterviewRecord interview = requireInterviewForUpdate(interviewId);
        if (!"ACTIVE".equals(interview.getStatus())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview no longer accepts responses");
        }
        QuestionRecord question = reflectionInterviewMapper.findOwnedInterviewQuestion(
            interviewId,
            request.getQuestionId(),
            currentUserId()
        );
        if (question == null || !"active".equals(question.getStatus())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview question is not current");
        }

        String mode = request.getMode();
        if ("ANSWER".equals(mode)) {
            if (request.getContent() == null || request.getContent().isBlank()) {
                throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "Answer content is required");
            }
            savePrivateAnswer(interview, question, request.getContent().trim());
            resolveQuestion(interview, question, "answered", mode);
            interview.setAnsweredCount(interview.getAnsweredCount() + 1);
            List<String> coverage = coverage(interview);
            if (!coverage.contains(question.getCoverageArea())) {
                coverage.add(question.getCoverageArea());
            }
            interview.setCoverageJson(writeJson(coverage));
        } else {
            resolveQuestion(
                interview,
                question,
                "BOOK_ONLY".equals(mode) ? "replaced" : "skipped",
                mode
            );
            interview.setSkippedCount(interview.getSkippedCount() + 1);
        }

        boolean bookOnly = "BOOK_ONLY".equals(mode);
        boolean pauseForChoice = "ANSWER".equals(mode)
            && (interview.getAnsweredCount() == MINIMUM_ANSWERS
                || interview.getAnsweredCount() == TARGET_ANSWERS);
        boolean generateNext = interview.getGeneratedCount() < MAXIMUM_QUESTIONS
            && !pauseForChoice;
        if (!generateNext && interview.getGeneratedCount() >= MAXIMUM_QUESTIONS
            && interview.getAnsweredCount() < MINIMUM_ANSWERS) {
            reflectionInterviewMapper.reopenFirstSkippedQuestion(interviewId, currentUserId());
        }
        requireChanged(reflectionInterviewMapper.updateInterview(interview), "Interview progress could not be saved");
        return new ResponseResult(
            generateNext,
            bookOnly,
            bookOnly ? question.getCoverageArea() : null
        );
    }

    public ReflectionInterviewResponse continueInterview(Long interviewId) {
        boolean shouldGenerate = Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            reflectionBusiness.requireEnabled();
            ReflectionInterviewRecord interview = requireInterviewForUpdate(interviewId);
            QuestionRecord current = reflectionInterviewMapper.findCurrentInterviewQuestion(
                interviewId,
                currentUserId()
            );
            if (current != null) {
                return false;
            }
            if (!"ACTIVE".equals(interview.getStatus())
                || interview.getGeneratedCount() >= MAXIMUM_QUESTIONS) {
                throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview cannot continue from this state");
            }
            return true;
        }));
        if (shouldGenerate) {
            generateAndPersistNextQuestion(interviewId, false, null);
        }
        return response(requireInterview(interviewId));
    }

    public ReflectionInterviewRecord requireInterview(Long interviewId) {
        ReflectionInterviewRecord interview = reflectionInterviewMapper.findOwnedInterview(
            interviewId,
            currentUserId()
        );
        if (interview == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reflection Interview not found");
        }
        return interview;
    }

    public ReflectionInterviewRecord requireInterviewForUpdate(Long interviewId) {
        if (reflectionInterviewMapper.lockOwnedInterview(interviewId, currentUserId()) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reflection Interview not found");
        }
        return requireInterview(interviewId);
    }

    private void generateAndPersistNextQuestion(
        Long interviewId,
        boolean bookOnly,
        String replacementCoverage
    ) {
        QuestionPreparation preparation = transactionTemplate.execute(
            status -> prepareQuestion(interviewId, bookOnly, replacementCoverage)
        );
        if (preparation == null) {
            return;
        }
        QuestionDraft draft = questionGenerator.generate(
            preparation.windowId(),
            preparation.reflectionContent(),
            preparation.coverageArea(),
            preparation.bookOnly(),
            preparation.previousQuestions(),
            preparation.previousAnswers(),
            preparation.evidence().stream()
                .map(source -> new EvidenceDraft(
                    source.alias(),
                    source.type(),
                    source.excerpt()
                ))
                .toList(),
            preparation.primarySource().alias(),
            properties.getInterviewPromptVersion(),
            depthForQuestion(preparation.expectedGeneratedCount() + 1),
            preparation.testData()
        );
        transactionTemplate.executeWithoutResult(
            status -> persistQuestion(preparation, draft)
        );
    }

    private QuestionPreparation prepareQuestion(
        Long interviewId,
        boolean bookOnly,
        String replacementCoverage
    ) {
        ReflectionInterviewRecord interview = requireInterviewForUpdate(interviewId);
        if (interview.getGeneratedCount() >= MAXIMUM_QUESTIONS
            || reflectionInterviewMapper.findCurrentInterviewQuestion(interviewId, currentUserId()) != null) {
            return null;
        }
        ReflectionRevisionRecord revision = reflectionRevisionMapper.findOwnedRevision(
            interview.getSourceRevisionId(),
            currentUserId()
        );
        if (revision == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Interview revision not found");
        }
        String coverageArea = replacementCoverage == null
            ? COVERAGE_SEQUENCE.get(interview.getGeneratedCount())
            : replacementCoverage;
        List<QuestionRecord> previous = reflectionInterviewMapper.findInterviewQuestions(
            interview.getId(),
            currentUserId()
        );
        ReflectionEvidenceCatalog.EvidenceCatalog catalog = evidenceCatalog.load(
            interview,
            revision,
            true
        );
        Source primarySource = catalog.primaryFor(coverageArea, bookOnly);
        return new QuestionPreparation(
            interview.getId(),
            interview.getWindowId(),
            revision.getContent(),
            coverageArea,
            bookOnly,
            previous.stream()
                .limit(MAXIMUM_QUESTIONS)
                .map(question -> truncate(question.getQuestionText(), 500))
                .toList(),
            catalog.answers().stream().map(Source::excerpt).toList(),
            catalog.all(),
            primarySource,
            interview.getGeneratedCount(),
            interview.isTestData()
        );
    }

    private void persistQuestion(QuestionPreparation preparation, QuestionDraft draft) {
        ReflectionInterviewRecord interview = requireInterviewForUpdate(preparation.interviewId());
        if (interview.getGeneratedCount() != preparation.expectedGeneratedCount()) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview changed while the question was generated");
        }
        if (reflectionInterviewMapper.findCurrentInterviewQuestion(interview.getId(), currentUserId()) != null) {
            return;
        }
        Source primarySource = preparation.primarySource();
        QuestionRecord question = QuestionRecord.builder()
            .sessionId(interview.getSessionId())
            .windowId(interview.getWindowId())
            .userId(currentUserId())
            .reflectionInterviewId(interview.getId())
            .questionText(draft.question())
            .questionType("reflection_interview")
            .coverageArea(preparation.coverageArea())
            .sourceType(primarySource.type())
            .sourceRefId(primarySource.refId())
            .sourceExcerpt(primarySource.excerpt())
            .sourceVersion(primarySource.version())
            .sourceStale(primarySource.stale())
            .sourceFallback(primarySource.fallback())
            .sensitivity("PERSONAL_RESPONSE".equals(preparation.coverageArea()) ? "MEDIUM" : "LOW")
            .status("active")
            .aiModel(draft.model())
            .testData(preparation.testData())
            .build();
        requireChanged(questionMapper.insert(question), "Interview question could not be saved");
        interview.setGeneratedCount(interview.getGeneratedCount() + 1);
        requireChanged(reflectionInterviewMapper.updateInterview(interview), "Interview progress could not be saved");
    }

    private void savePrivateAnswer(
        ReflectionInterviewRecord interview,
        QuestionRecord question,
        String content
    ) {
        ReflectionInterviewAnswerRecord current = reflectionInterviewMapper.findCurrentAnswerForUpdate(
            interview.getId(),
            question.getId(),
            currentUserId()
        );
        if (current == null) {
            SessionInsightRecord answer = SessionInsightRecord.builder()
                .sessionId(interview.getSessionId())
                .userId(currentUserId())
                .questionId(question.getId())
                .insightType("question_answer")
                .content(content)
                .visibility("PRIVATE")
                .insightOrder(sessionInsightMapper.selectNextOrder(interview.getSessionId()))
                .testData(interview.isTestData())
                .build();
            requireChanged(sessionInsightMapper.insert(answer), "Interview answer could not be saved");
            appendAnswerRevision(
                interview,
                question,
                null,
                content,
                "WORDING_ONLY",
                answer.getId()
            );
        } else {
            appendAnswerRevision(
                interview,
                question,
                current,
                content,
                "WORDING_ONLY",
                current.getSessionInsightId()
            );
        }
    }

    private void appendAnswerRevision(
        ReflectionInterviewRecord interview,
        QuestionRecord question,
        ReflectionInterviewAnswerRecord current,
        String content,
        String revisionKind,
        Long sessionInsightId
    ) {
        if (current != null) {
            requireChanged(
                reflectionInterviewMapper.archiveCurrentAnswer(
                    current.getId(),
                    interview.getId(),
                    currentUserId()
                ),
                "Interview answer revision could not be archived"
            );
            requireChanged(
                sessionInsightMapper.updateQuestionAnswer(question.getId(), currentUserId(), content),
                "Interview answer could not be updated"
            );
        }
        ReflectionInterviewAnswerRecord revision = ReflectionInterviewAnswerRecord.builder()
            .interviewId(interview.getId())
            .questionId(question.getId())
            .sessionInsightId(sessionInsightId)
            .userId(currentUserId())
            .version(reflectionInterviewMapper.nextAnswerVersion(interview.getId(), question.getId()))
            .content(content)
            .responseMode("ANSWER")
            .revisionKind(revisionKind)
            .sourceAnswerRevisionId(current == null ? null : current.getId())
            .current(true)
            .testData(interview.isTestData())
            .build();
        requireChanged(
            reflectionInterviewMapper.insertAnswerRevision(revision),
            "Interview answer revision could not be saved"
        );
    }

    private ReflectionInterviewRecord forkFromAnswer(
        ReflectionInterviewRecord sourceInterview,
        QuestionRecord targetQuestion,
        ReflectionInterviewAnswerRecord targetAnswer,
        String targetContent
    ) {
        List<QuestionRecord> sourceQuestions = reflectionInterviewMapper.findInterviewQuestions(
            sourceInterview.getId(),
            currentUserId()
        );
        int targetIndex = -1;
        for (int index = 0; index < sourceQuestions.size(); index++) {
            if (Objects.equals(sourceQuestions.get(index).getId(), targetQuestion.getId())) {
                targetIndex = index;
                break;
            }
        }
        if (targetIndex < 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Interview question not found");
        }
        for (int index = 0; index <= targetIndex; index++) {
            if ("active".equals(sourceQuestions.get(index).getStatus())) {
                throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview prefix is not resolved");
            }
        }

        sourceInterview.setStatus("ABANDONED");
        requireChanged(
            reflectionInterviewMapper.updateInterview(sourceInterview),
            "Previous interview lineage could not be closed"
        );

        ReflectionInterviewRecord fork = ReflectionInterviewRecord.builder()
            .reflectionInsightId(sourceInterview.getReflectionInsightId())
            .sourceRevisionId(sourceInterview.getSourceRevisionId())
            .sessionId(sourceInterview.getSessionId())
            .windowId(sourceInterview.getWindowId())
            .userId(currentUserId())
            .parentInterviewId(sourceInterview.getId())
            .forkQuestionId(targetQuestion.getId())
            .status("ACTIVE")
            .coverageJson("[]")
            .answeredCount(0)
            .skippedCount(0)
            .generatedCount(0)
            .promptVersion(sourceInterview.getPromptVersion())
            .testData(sourceInterview.isTestData())
            .build();
        requireChanged(reflectionInterviewMapper.insertInterview(fork), "Interview fork could not be saved");

        List<String> coverage = new ArrayList<>();
        for (int index = 0; index <= targetIndex; index++) {
            QuestionRecord sourceQuestion = sourceQuestions.get(index);
            boolean target = Objects.equals(sourceQuestion.getId(), targetQuestion.getId());
            QuestionRecord copiedQuestion = copyQuestion(fork, sourceQuestion);
            if (target) {
                copiedQuestion.setResponseMode("ANSWER");
                copiedQuestion.setStatus("answered");
            }
            requireChanged(questionMapper.insert(copiedQuestion), "Interview fork question could not be saved");
            fork.setGeneratedCount(fork.getGeneratedCount() + 1);

            if ("ANSWER".equals(sourceQuestion.getResponseMode())) {
                ReflectionInterviewAnswerRecord sourceAnswer = target
                    ? targetAnswer
                    : reflectionInterviewMapper.findCurrentAnswer(
                        sourceInterview.getId(),
                        sourceQuestion.getId(),
                        currentUserId()
                    );
                if (sourceAnswer == null) {
                    throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview answer lineage is incomplete");
                }
                SessionInsightRecord copiedInsight = copyAnswerInsight(
                    fork,
                    copiedQuestion,
                    sourceAnswer.getSessionInsightId(),
                    target ? targetContent : sourceAnswer.getContent()
                );
                ReflectionInterviewAnswerRecord copiedRevision = ReflectionInterviewAnswerRecord.builder()
                    .interviewId(fork.getId())
                    .questionId(copiedQuestion.getId())
                    .sessionInsightId(copiedInsight.getId())
                    .userId(currentUserId())
                    .version(1)
                    .content(copiedInsight.getContent())
                    .responseMode("ANSWER")
                    .revisionKind(target ? "RESTART_FROM_HERE" : "WORDING_ONLY")
                    .sourceAnswerRevisionId(sourceAnswer.getId())
                    .current(true)
                    .testData(fork.isTestData())
                    .build();
                requireChanged(
                    reflectionInterviewMapper.insertAnswerRevision(copiedRevision),
                    "Interview fork answer could not be saved"
                );
                fork.setAnsweredCount(fork.getAnsweredCount() + 1);
                if (copiedQuestion.getCoverageArea() != null
                    && !coverage.contains(copiedQuestion.getCoverageArea())) {
                    coverage.add(copiedQuestion.getCoverageArea());
                }
            } else {
                fork.setSkippedCount(fork.getSkippedCount() + 1);
            }
        }
        fork.setCoverageJson(writeJson(coverage));
        requireChanged(
            reflectionInterviewMapper.updateInterview(fork),
            "Interview fork progress could not be saved"
        );
        return fork;
    }

    private QuestionRecord copyQuestion(
        ReflectionInterviewRecord fork,
        QuestionRecord source
    ) {
        return QuestionRecord.builder()
            .sessionId(fork.getSessionId())
            .windowId(fork.getWindowId())
            .userId(currentUserId())
            .reflectionInterviewId(fork.getId())
            .questionText(source.getQuestionText())
            .questionType(source.getQuestionType())
            .coverageArea(source.getCoverageArea())
            .responseMode(source.getResponseMode())
            .sourceType(source.getSourceType())
            .sourceRefId(source.getSourceRefId())
            .sourceExcerpt(source.getSourceExcerpt())
            .sourceVersion(source.getSourceVersion())
            .sourceStale(source.isSourceStale())
            .sourceFallback(source.isSourceFallback())
            .sensitivity(source.getSensitivity())
            .status(source.getStatus())
            .aiModel(source.getAiModel())
            .testData(fork.isTestData())
            .build();
    }

    private SessionInsightRecord copyAnswerInsight(
        ReflectionInterviewRecord fork,
        QuestionRecord copiedQuestion,
        Long sourceInsightId,
        String content
    ) {
        SessionInsightRecord sourceInsight = sessionInsightMapper.findActiveById(
            fork.getSessionId(),
            sourceInsightId,
            currentUserId()
        );
        if (sourceInsight == null) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Interview answer projection is missing");
        }
        SessionInsightRecord copiedInsight = SessionInsightRecord.builder()
            .sessionId(fork.getSessionId())
            .userId(currentUserId())
            .questionId(copiedQuestion.getId())
            .insightType("question_answer")
            .title(sourceInsight.getTitle())
            .content(content)
            .evidence(sourceInsight.getEvidence())
            .authorName(sourceInsight.getAuthorName())
            .visibility("PRIVATE")
            .reviewedOn(sourceInsight.getReviewedOn())
            .insightOrder(sessionInsightMapper.selectNextOrder(fork.getSessionId()))
            .testData(fork.isTestData())
            .build();
        requireChanged(
            sessionInsightMapper.insert(copiedInsight),
            "Interview answer projection could not be copied"
        );
        return copiedInsight;
    }

    private void resolveQuestion(
        ReflectionInterviewRecord interview,
        QuestionRecord question,
        String status,
        String mode
    ) {
        requireChanged(reflectionInterviewMapper.resolveInterviewQuestion(
            interview.getId(),
            question.getId(),
            currentUserId(),
            status,
            mode
        ), "Interview question could not be resolved");
    }

    private SessionWindowRecord ensureReflectionWindow(SessionInsightRecord reflection) {
        SessionWindowRecord existing = reflectionInterviewMapper.findActiveWindowBySessionAndType(
            reflection.getSessionId(),
            currentUserId(),
            "reflection"
        );
        if (existing != null) {
            return existing;
        }
        SessionWindowRecord window = SessionWindowRecord.builder()
            .sessionId(reflection.getSessionId())
            .userId(currentUserId())
            .windowType("reflection")
            .title("Reflection Interview")
            .position(sessionWindowMapper.selectNextPosition(reflection.getSessionId()))
            .status("open")
            .testData(reflection.isTestData())
            .build();
        requireChanged(sessionWindowMapper.insert(window), "Reflection window could not be saved");
        return window;
    }

    private ReflectionInterviewResponse response(ReflectionInterviewRecord interview) {
        DiscussionGuideRecord guide = discussionGuideMapper.findCurrentGuideByInterview(
            interview.getId(),
            currentUserId()
        );
        QuestionRecord current = reflectionInterviewMapper.findCurrentInterviewQuestion(
            interview.getId(),
            currentUserId()
        );
        List<InterviewAnswerDto> answers = reflectionInterviewMapper.findCurrentAnswers(
                interview.getId(),
                currentUserId()
            ).stream()
            .map(this::toAnswerDto)
            .toList();
        return ReflectionInterviewResponse.builder()
            .interviewId(interview.getId())
            .parentInterviewId(interview.getParentInterviewId())
            .forkQuestionId(interview.getForkQuestionId())
            .reflectionId(interview.getReflectionInsightId())
            .sourceRevisionId(interview.getSourceRevisionId())
            .status(interview.getStatus())
            .answeredCount(interview.getAnsweredCount())
            .skippedCount(interview.getSkippedCount())
            .generatedCount(interview.getGeneratedCount())
            .minimumAnswers(MINIMUM_ANSWERS)
            .targetAnswers(TARGET_ANSWERS)
            .maximumQuestions(MAXIMUM_QUESTIONS)
            .coverage(coverage(interview))
            .answers(answers)
            .currentQuestion(toQuestionDto(current))
            .canGenerateGuide(interview.getAnsweredCount() >= MINIMUM_ANSWERS)
            .maxReached(interview.getGeneratedCount() >= MAXIMUM_QUESTIONS)
            .guideId(guide == null ? null : guide.getId())
            .build();
    }

    private InterviewAnswerDto toAnswerDto(ReflectionInterviewAnswerRecord answer) {
        return InterviewAnswerDto.builder()
            .answerRevisionId(answer.getId())
            .questionId(answer.getQuestionId())
            .question(answer.getQuestionText())
            .content(answer.getContent())
            .version(answer.getVersion())
            .responseMode(answer.getResponseMode())
            .build();
    }

    private InterviewQuestionDto toQuestionDto(QuestionRecord question) {
        if (question == null) {
            return null;
        }
        return InterviewQuestionDto.builder()
            .questionId(question.getId())
            .question(question.getQuestionText())
            .coverageArea(question.getCoverageArea())
            .sourceType(question.getSourceType())
            .sourceRefId(question.getSourceRefId())
            .sourceExcerpt(question.getSourceExcerpt())
            .sourceVersion(question.getSourceVersion())
            .sourceStale(question.isSourceStale())
            .sourceFallback(question.isSourceFallback())
            .sensitivity(question.getSensitivity())
            .status(question.getStatus())
            .build();
    }

    private List<String> coverage(ReflectionInterviewRecord interview) {
        if (interview.getCoverageJson() == null || interview.getCoverageJson().isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(
                interview.getCoverageJson(),
                new TypeReference<List<String>>() { }
            ));
        } catch (JsonProcessingException exception) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Interview coverage is invalid");
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Interview progress could not be serialized");
        }
    }

    private String truncate(String value, int max) {
        String safe = value == null ? "" : value.trim();
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    private String depthForQuestion(int questionOrdinal) {
        if (questionOrdinal <= MINIMUM_ANSWERS) {
            return "SIMPLE";
        }
        if (questionOrdinal <= TARGET_ANSWERS) {
            return "STANDARD";
        }
        return "DEEP";
    }

    private long currentUserId() {
        return AuthContext.requireUserId();
    }

    private void requireChanged(int changed, String reason) {
        if (changed <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
        }
    }

    private record StartResult(Long interviewId, boolean created) {
    }

    private record ResponseResult(
        boolean generateNext,
        boolean bookOnly,
        String replacementCoverage
    ) {
    }

    private record AnswerUpdateResult(Long interviewId, boolean generateNext) {
    }

    private record QuestionPreparation(
        Long interviewId,
        Long windowId,
        String reflectionContent,
        String coverageArea,
        boolean bookOnly,
        List<String> previousQuestions,
        List<String> previousAnswers,
        List<Source> evidence,
        Source primarySource,
        int expectedGeneratedCount,
        boolean testData
    ) {
    }
}
