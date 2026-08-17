package com.margins.reflectionloop.service;

import com.margins.reflectionloop.business.DiscussionGuideBusiness;
import com.margins.reflectionloop.business.DiscussionGuideProjectionBusiness;
import com.margins.reflectionloop.business.DiscussionRunBusiness;
import com.margins.reflectionloop.business.ReflectionBusiness;
import com.margins.reflectionloop.business.ReflectionInterviewBusiness;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReflectionLoopService {
    private final ReflectionBusiness reflectionBusiness;
    private final ReflectionInterviewBusiness interviewBusiness;
    private final DiscussionGuideBusiness guideBusiness;
    private final DiscussionGuideProjectionBusiness guideProjectionBusiness;
    private final DiscussionRunBusiness runBusiness;

    @Transactional
    public ReflectionLoopResponse createReflection(Long sessionId, SaveReflectionRequest request) {
        return reflectionBusiness.create(sessionId, request);
    }

    @Transactional(readOnly = true)
    public ReflectionLoopResponse reflection(Long reflectionId) {
        return reflectionBusiness.get(reflectionId);
    }

    @Transactional(readOnly = true)
    public ReflectionLoopResponse sessionReflection(Long sessionId) {
        return reflectionBusiness.getPrimaryBySession(sessionId);
    }

    @Transactional
    public ReflectionLoopResponse updateReflection(Long reflectionId, SaveReflectionRequest request) {
        return reflectionBusiness.update(reflectionId, request);
    }

    public ReflectionInterviewResponse startInterview(Long reflectionId) {
        return interviewBusiness.start(reflectionId);
    }

    @Transactional(readOnly = true)
    public ReflectionInterviewResponse interview(Long interviewId) {
        return interviewBusiness.get(interviewId);
    }

    public ReflectionInterviewResponse respond(
        Long interviewId,
        InterviewResponseRequest request
    ) {
        return interviewBusiness.respond(interviewId, request);
    }

    public ReflectionInterviewResponse updateAnswer(
        Long interviewId,
        Long questionId,
        UpdateInterviewAnswerRequest request
    ) {
        return interviewBusiness.updateAnswer(interviewId, questionId, request);
    }

    public ReflectionInterviewResponse continueInterview(Long interviewId) {
        return interviewBusiness.continueInterview(interviewId);
    }

    public DiscussionGuideResponse createGuide(Long interviewId, GuideBriefRequest request) {
        return guideBusiness.create(interviewId, request);
    }

    @Transactional(readOnly = true)
    public DiscussionGuideResponse guide(Long guideId) {
        return guideBusiness.get(guideId);
    }

    @Transactional(readOnly = true)
    public DiscussionGuideVersionsResponse guideVersions(Long interviewId) {
        return guideBusiness.versions(interviewId);
    }

    @Transactional(readOnly = true)
    public DiscussionGuideProjectionResponse guideProjection(
        Long guideId,
        String projection
    ) {
        return guideProjectionBusiness.projection(guideId, projection);
    }

    @Transactional(readOnly = true)
    public DiscussionGuideMarkdownExportResponse guideMarkdown(
        Long guideId,
        String projection
    ) {
        return guideProjectionBusiness.markdown(guideId, projection);
    }

    public DiscussionGuideResponse editGuide(
        Long guideId,
        EditDiscussionGuideRequest request
    ) {
        return guideBusiness.edit(guideId, request);
    }

    public DiscussionGuideResponse regenerateGuide(
        Long guideId,
        RegenerateDiscussionGuideRequest request
    ) {
        return guideBusiness.regenerate(guideId, request);
    }

    @Transactional
    public DiscussionRunResponse createRun(Long guideId) {
        return runBusiness.create(guideId);
    }

    @Transactional(readOnly = true)
    public DiscussionRunResponse run(Long runId) {
        return runBusiness.get(runId);
    }

    public GuidedDiscussionTurnResponse turn(
        Long runId,
        GuidedDiscussionTurnRequest request
    ) {
        return runBusiness.turn(runId, request);
    }

    public ReflectionRefinementResponse complete(
        Long runId,
        CompleteDiscussionRunRequest request
    ) {
        return runBusiness.complete(runId, request);
    }

    public ReflectionRefinementResponse refinement(Long runId) {
        return runBusiness.refinement(runId);
    }

    @Transactional
    public ReflectionLoopResponse refine(
        Long runId,
        SaveReflectionRefinementRequest request
    ) {
        return runBusiness.refine(runId, request);
    }
}
