package com.margins.reflectionloop.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationResult;
import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.reflectionloop.ReflectionLoopProperties;
import com.margins.reflectionloop.ai.DiscussionDirector;
import com.margins.reflectionloop.ai.DiscussionDirector.DirectorDecision;
import com.margins.reflectionloop.ai.ReflectionRefinementAssistant;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.DiscussionRunMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.DiscussionRunRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.reflectionloop.model.dto.request.CompleteDiscussionRunRequest;
import com.margins.reflectionloop.model.dto.request.GuidedDiscussionTurnRequest;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRefinementRequest;
import com.margins.reflectionloop.model.dto.response.DiscussionQuestionDto;
import com.margins.reflectionloop.model.dto.response.DiscussionRunResponse;
import com.margins.reflectionloop.model.dto.response.GuidedDiscussionTurnResponse;
import com.margins.reflectionloop.model.dto.response.PerspectiveCandidateDto;
import com.margins.reflectionloop.model.dto.response.ReflectionLoopResponse;
import com.margins.reflectionloop.model.dto.response.ReflectionRefinementResponse;
import com.margins.session.business.SessionWindowBusiness;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.model.SessionInsightRecord;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
@Slf4j
public class DiscussionRunBusiness {
    private final ReflectionBusiness reflectionBusiness;
    private final DiscussionGuideBusiness guideBusiness;
    private final ReflectionLoopProperties properties;
    private final ReflectionRevisionMapper reflectionRevisionMapper;
    private final DiscussionGuideMapper discussionGuideMapper;
    private final DiscussionRunMapper discussionRunMapper;
    private final SessionWindowBusiness sessionWindowBusiness;
    private final PersonaMapper personaMapper;
    private final DiscussionDirector discussionDirector;
    private final ReflectionRefinementAssistant refinementAssistant;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public DiscussionRunResponse create(Long guideId) {
        reflectionBusiness.requireEnabled();
        DiscussionGuideRecord guide = guideBusiness.requireGuideForUpdate(guideId);
        DiscussionRunRecord existing = discussionRunMapper.findRunByGuide(guideId, currentUserId());
        if (existing != null) {
            return response(existing);
        }
        if (!Boolean.TRUE.equals(guide.getIsCurrent())) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Archived discussion guide cannot start a new run"
            );
        }
        List<DiscussionGuideItemRecord> items = discussionGuideMapper.findGuideItems(
            guideId,
            currentUserId()
        );
        if (items.isEmpty()) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Discussion guide has no items");
        }
        CreateSessionWindowResponse window = sessionWindowBusiness.ensureQuestionDebateWindow(
            items.get(0).getQuestionId()
        );
        DiscussionRunRecord run = DiscussionRunRecord.builder()
            .guideId(guideId)
            .windowId(window.getWindowId())
            .sessionId(guide.getSessionId())
            .userId(currentUserId())
            .currentItemId(items.get(0).getId())
            .status("READY")
            .directorVersion(properties.getDirectorVersion())
            .testData(guide.isTestData())
            .build();
        requireChanged(discussionRunMapper.insertRun(run), "Discussion run could not be saved");
        requireChanged(
            discussionGuideMapper.updateGuideStatus(guideId, currentUserId(), "ACTIVE"),
            "Discussion guide could not be activated"
        );
        return response(run);
    }

    public DiscussionRunResponse get(Long runId) {
        reflectionBusiness.requireEnabled();
        return response(requireRun(runId));
    }

    public GuidedDiscussionTurnResponse turn(
        Long runId,
        GuidedDiscussionTurnRequest request
    ) {
        reflectionBusiness.requireEnabled();
        DiscussionRunRecord run = requireRunForUpdate(runId);
        if ("COMPLETED".equals(run.getStatus()) || "ABANDONED".equals(run.getStatus())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Discussion run is closed");
        }
        List<DiscussionGuideItemRecord> items = discussionGuideMapper.findGuideItems(
            run.getGuideId(),
            currentUserId()
        );
        DiscussionGuideRecord guide = guideBusiness.requireGuide(run.getGuideId());
        DiscussionGuideItemRecord current = currentItem(run);
        if (current == null) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Discussion run has no current item");
        }
        if ((request.getNavigation() == null || "RESPOND".equals(request.getNavigation()))
            && hasPendingPerspective(run)) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Choose or skip the pending perspective before continuing"
            );
        }

        if ("SELECT_PERSPECTIVE".equals(request.getNavigation())) {
            return selectPerspective(run, guide, items, current, request);
        }
        if ("SKIP_PERSPECTIVE".equals(request.getNavigation())) {
            return skipPerspective(run, items, current);
        }

        ModerationEventRecord moderation = sessionWindowBusiness.moderateGuidedTurn(
            run.getWindowId(),
            request.getContent(),
            guide.getDepth()
        );
        if (sessionWindowBusiness.blocksGuidedTurn(moderation)) {
            List<Long> structureCandidateIds = isDiscussionStructure(moderation)
                ? activePerspectiveIds()
                : List.of();
            DebateTurnResponse blocked = transactionTemplate.execute(status -> {
                DebateTurnResponse result = sessionWindowBusiness.persistGuidedTurnAtomically(
                    run.getWindowId(),
                    current.getQuestionId(),
                    request.getContent(),
                    null,
                    moderation,
                    guide.getDepth()
                );
                if (!structureCandidateIds.isEmpty()) {
                    run.setPendingPerspectiveItemId(current.getId());
                    run.setPendingPerspectiveIdsJson(jsonIds(structureCandidateIds));
                    run.setLastDirectorAction(null);
                    run.setStatus("ACTIVE");
                    requireChanged(
                        discussionRunMapper.updateRunProgress(run),
                        "Discussion perspective choice could not be saved"
                    );
                }
                return result;
            });
            return turnResponse(
                run,
                requireDebate(blocked),
                null,
                current,
                discussionDirector.next(items, current),
                candidateDtos(structureCandidateIds),
                !structureCandidateIds.isEmpty()
            );
        }

        DirectorDecision decision = discussionDirector.decide(
            run.getWindowId(),
            current,
            items,
            request.getContent(),
            request.getNavigation() == null ? "RESPOND" : request.getNavigation(),
            properties.getDirectorVersion(),
            guide.getDepth(),
            guide.isTestData(),
            personaMapper.findActiveForUser(currentUserId())
        );
        if ("ASK_FOLLOW_UP".equals(decision.action())
            && discussionRunMapper.countDirectorMessages(
                run.getWindowId(),
                current.getQuestionId(),
                currentUserId()
            ) >= 2) {
            DiscussionGuideItemRecord boundedNext = discussionDirector.next(items, current);
            decision = new DirectorDecision(
                boundedNext == null ? "SUMMARIZE_TOPIC" : "MOVE_NEXT_TOPIC",
                boundedNext
            );
        }
        if ("CALL_PERSPECTIVE".equals(decision.action())) {
            List<Long> candidateIds = boundedCandidates(decision.candidatePersonaIds());
            if (candidateIds.isEmpty()) {
                decision = new DirectorDecision("ASK_FOLLOW_UP", current);
            } else {
                DirectorDecision perspectiveDecision = decision;
                run.setPendingPerspectiveItemId(current.getId());
                run.setPendingPerspectiveIdsJson(jsonIds(candidateIds));
                DebateTurnResponse debate = transactionTemplate.execute(status -> {
                    DebateTurnResponse result = sessionWindowBusiness.persistGuidedTurnAtomically(
                        run.getWindowId(),
                        current.getQuestionId(),
                        request.getContent(),
                        directorReply(perspectiveDecision, current),
                        moderation,
                        guide.getDepth()
                    );
                    updateProgress(run, perspectiveDecision.action(), current, candidateIds);
                    return result;
                });
                return turnResponse(
                    run,
                    requireDebate(debate),
                    perspectiveDecision.action(),
                    current,
                    discussionDirector.next(items, current),
                    candidateDtos(candidateIds),
                    true
                );
            }
        }
        Long pendingPerspectiveItemId = run.getPendingPerspectiveItemId();
        DirectorDecision resolvedDecision = decision;
        DebateTurnResponse debate = transactionTemplate.execute(status -> {
            DebateTurnResponse result = sessionWindowBusiness.persistGuidedTurnAtomically(
                run.getWindowId(),
                current.getQuestionId(),
                request.getContent(),
                directorReply(resolvedDecision, current),
                moderation,
                guide.getDepth()
            );
            if (pendingPerspectiveItemId != null
                && ("NEXT".equals(request.getNavigation()) || "FINISH".equals(request.getNavigation()))) {
                updateUnclaimedPerspectiveProgress(
                    run,
                    resolvedDecision.action(),
                    resolvedDecision.targetItem(),
                    pendingPerspectiveItemId
                );
            } else {
                updateProgress(run, resolvedDecision.action(), resolvedDecision.targetItem(), null);
            }
            return result;
        });
        DiscussionGuideItemRecord updatedCurrent = run.getCurrentItemId() == null
            ? null
            : discussionGuideMapper.findOwnedGuideItem(run.getCurrentItemId(), currentUserId());
        return turnResponse(
            run,
            requireDebate(debate),
            resolvedDecision.action(),
            updatedCurrent,
            discussionDirector.next(items, updatedCurrent),
            List.of(),
            false
        );
    }

    public ReflectionRefinementResponse complete(
        Long runId,
        CompleteDiscussionRunRequest ignoredRequest
    ) {
        return resolveRefinement(prepareRefinement(runId, true));
    }

    public ReflectionRefinementResponse refinement(Long runId) {
        return resolveRefinement(prepareRefinement(runId, false));
    }

    private RefinementPreparation prepareRefinement(Long runId, boolean completeRun) {
        RefinementPreparation preparation = transactionTemplate.execute(
            status -> prepareRefinementInTransaction(runId, completeRun)
        );
        if (preparation == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Reflection refinement preparation failed"
            );
        }
        return preparation;
    }

    private RefinementPreparation prepareRefinementInTransaction(
        Long runId,
        boolean completeRun
    ) {
        reflectionBusiness.requireEnabled();
        DiscussionRunRecord run = requireRunForUpdate(runId);
        if (!"COMPLETED".equals(run.getStatus()) && completeRun) {
            run.setStatus("COMPLETED");
            run.setCurrentItemId(null);
            run.setLastDirectorAction("FINISH_DISCUSSION");
            requireChanged(
                discussionRunMapper.updateRunProgress(run),
                "Discussion run could not be completed"
            );
            discussionGuideMapper.updateGuideStatus(run.getGuideId(), currentUserId(), "COMPLETED");
        }
        if (!"COMPLETED".equals(run.getStatus())) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Discussion must be completed before refinement"
            );
        }
        DiscussionGuideRecord guide = guideBusiness.requireGuide(run.getGuideId());
        ReflectionRevisionRecord initial = reflectionRevisionMapper.findOwnedRevision(
            guide.getSourceRevisionId(),
            currentUserId()
        );
        if (initial == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_NOT_FOUND,
                "Refinement source revision not found"
            );
        }
        SessionInsightRecord reflection = reflectionBusiness.requireReflection(
            guide.getReflectionInsightId()
        );
        List<MessageRecord> transcript = discussionRunMapper.findOwnedDiscussionTranscript(
            run.getWindowId(),
            currentUserId()
        );
        String transcriptHash = transcriptHash(transcript);
        String promptVersion = properties.getRefinementPromptVersion();
        String inputHash = sha256(
            run.getId() + "|" + guide.getSourceRevisionId() + "|" + transcriptHash + "|" + promptVersion
        );
        String perspectives = discussionRunMapper.findPersonaPerspectiveSummary(
            run.getWindowId(),
            currentUserId()
        );
        if (perspectives == null || perspectives.isBlank()) {
            perspectives = "토론에서 새 Persona 관점을 호출하지 않았습니다. 직접 정리하거나 처음 생각을 유지할 수 있습니다.";
        }
        boolean generate = !inputHash.equals(run.getRefinementInputHash())
            || run.getRefinementSuggestionStatus() == null;
        if (generate) {
            run.setRefinementInputHash(inputHash);
            run.setRefinementTranscriptHash(transcriptHash);
            run.setRefinementPromptVersion(promptVersion);
            run.setRefinementSuggestionStatus("PENDING");
            run.setRefinementSuggestionContent(null);
            run.setRefinementGenerationMetadataJson(null);
            run.setRefinementGeneratedAt(null);
            requireChanged(
                discussionRunMapper.claimRunRefinementSuggestion(run),
                "Reflection refinement suggestion could not be claimed"
            );
        }
        return new RefinementPreparation(
            run,
            guide,
            initial.getContent(),
            reflection.getContent(),
            perspectives,
            inputHash,
            generate
        );
    }

    private ReflectionRefinementResponse resolveRefinement(RefinementPreparation preparation) {
        if (!preparation.generate()) {
            return refinementResponse(preparation, preparation.run());
        }
        AiGenerationResult<String> generation = refinementAssistant.suggestWithMetadata(
            preparation.run().getWindowId(),
            preparation.initialContent(),
            preparation.perspectiveSummary(),
            preparation.run().getRefinementPromptVersion(),
            preparation.guide().getDepth(),
            preparation.guide().isTestData()
        );
        DiscussionRunRecord persisted = transactionTemplate.execute(
            status -> persistRefinementGeneration(preparation, generation)
        );
        if (persisted == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Reflection refinement result could not be saved"
            );
        }
        return refinementResponse(preparation, persisted);
    }

    private DiscussionRunRecord persistRefinementGeneration(
        RefinementPreparation preparation,
        AiGenerationResult<String> generation
    ) {
        DiscussionRunRecord run = requireRunForUpdate(preparation.run().getId());
        if (!preparation.inputHash().equals(run.getRefinementInputHash())
            || !"PENDING".equals(run.getRefinementSuggestionStatus())) {
            return run;
        }
        boolean ready = generation.value() != null && !generation.value().isBlank();
        run.setRefinementSuggestionStatus(ready ? "READY" : "FAILED");
        run.setRefinementSuggestionContent(ready ? generation.value() : null);
        run.setRefinementGenerationMetadataJson(generationMetadataJson(generation));
        requireChanged(
            discussionRunMapper.finalizeRunRefinementSuggestion(run),
            "Reflection refinement result could not be finalized"
        );
        return requireRun(run.getId());
    }

    private ReflectionRefinementResponse refinementResponse(
        RefinementPreparation preparation,
        DiscussionRunRecord run
    ) {
        return ReflectionRefinementResponse.builder()
            .runId(run.getId())
            .reflectionId(preparation.guide().getReflectionInsightId())
            .initialContent(preparation.initialContent())
            .currentContent(preparation.currentContent())
            .perspectiveSummary(preparation.perspectiveSummary())
            .suggestionStatus(run.getRefinementSuggestionStatus())
            .suggestedContent(run.getRefinementSuggestionContent())
            .build();
    }

    public ReflectionLoopResponse refine(
        Long runId,
        SaveReflectionRefinementRequest request
    ) {
        reflectionBusiness.requireEnabled();
        DiscussionRunRecord run = requireRunForUpdate(runId);
        if (!"COMPLETED".equals(run.getStatus())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Discussion must be completed before refinement");
        }
        if (run.getRefinementOutcome() != null) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Refinement outcome already exists");
        }
        DiscussionGuideRecord guide = guideBusiness.requireGuide(run.getGuideId());
        if ("KEPT".equals(request.getMode())) {
            if (!"KEPT".equals(request.getOutcome())) {
                throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "KEPT mode requires KEPT outcome");
            }
            run.setRefinementOutcome("KEPT");
            run.setRefinedRevisionId(null);
        } else {
            if (request.getFinalContent() == null || request.getFinalContent().isBlank()) {
                throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "Final Reflection content is required");
            }
            ReflectionRevisionRecord revision = reflectionBusiness.appendDiscussionRevision(
                guide.getReflectionInsightId(),
                guide.getSourceRevisionId(),
                request.getFinalContent()
            );
            run.setRefinementOutcome(request.getOutcome());
            run.setRefinedRevisionId(revision.getId());
        }
        requireChanged(discussionRunMapper.updateRunRefinement(run), "Refinement outcome could not be saved");
        return reflectionBusiness.get(guide.getReflectionInsightId());
    }

    private DiscussionRunRecord requireRun(Long runId) {
        DiscussionRunRecord run = discussionRunMapper.findOwnedRun(runId, currentUserId());
        if (run == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Discussion run not found");
        }
        return run;
    }

    private DiscussionRunRecord requireRunForUpdate(Long runId) {
        if (discussionRunMapper.lockOwnedRun(runId, currentUserId()) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Discussion run not found");
        }
        return requireRun(runId);
    }

    private DiscussionRunResponse response(DiscussionRunRecord run) {
        List<Long> pendingIds = parsePendingIds(run.getPendingPerspectiveIdsJson());
        return DiscussionRunResponse.builder()
            .runId(run.getId())
            .guideId(run.getGuideId())
            .windowId(run.getWindowId())
            .sessionId(run.getSessionId())
            .status(run.getStatus())
            .currentItem(guideBusiness.itemDto(currentItem(run)))
            .lastDirectorAction(run.getLastDirectorAction())
            .perspectiveCandidates(candidateDtos(pendingIds))
            .perspectiveSelectionRequired(!pendingIds.isEmpty())
            .build();
    }

    private DiscussionGuideItemRecord currentItem(DiscussionRunRecord run) {
        return run.getCurrentItemId() == null
            ? null
            : discussionGuideMapper.findOwnedGuideItem(run.getCurrentItemId(), currentUserId());
    }

    private GuidedDiscussionTurnResponse turnResponse(
        DiscussionRunRecord run,
        DebateTurnResponse debate,
        String action,
        DiscussionGuideItemRecord current,
        DiscussionGuideItemRecord next,
        List<PerspectiveCandidateDto> candidates,
        boolean selectionRequired
    ) {
        return GuidedDiscussionTurnResponse.builder()
            .runId(run.getId())
            .runStatus(run.getStatus())
            .moderation(debate.getModeration())
            .messages(debate.getMessages())
            .directorAction(action)
            .currentItem(guideBusiness.itemDto(current))
            .nextItem(guideBusiness.itemDto(next))
            .perspectiveCandidates(candidates)
            .perspectiveSelectionRequired(selectionRequired)
            .build();
    }

    private GuidedDiscussionTurnResponse selectPerspective(
        DiscussionRunRecord run,
        DiscussionGuideRecord guide,
        List<DiscussionGuideItemRecord> items,
        DiscussionGuideItemRecord current,
        GuidedDiscussionTurnRequest request
    ) {
        List<Long> pendingIds = parsePendingIds(run.getPendingPerspectiveIdsJson());
        if (!current.getId().equals(run.getPendingPerspectiveItemId())
            || !pendingIds.contains(request.getPersonaId())) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Perspective selection is no longer available"
            );
        }
        String claimToken = UUID.randomUUID().toString();
        Integer claimResult = transactionTemplate.execute(status ->
            discussionRunMapper.claimPendingPerspective(
                run.getId(),
                currentUserId(),
                current.getId(),
                request.getPersonaId(),
                claimToken,
                perspectiveClaimTtlSeconds()
            )
        );
        if (!Integer.valueOf(1).equals(claimResult)) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Perspective selection is already being processed"
            );
        }

        try {
            boolean structureSelection = run.getLastDirectorAction() == null;
            MessageRecord latestUserMessage = discussionRunMapper.findLatestUserMessage(
                run.getWindowId(),
                currentUserId(),
                current.getQuestionId()
            );
            if (!structureSelection
                && (latestUserMessage == null || latestUserMessage.getContent() == null)) {
                throw new ApiException(
                    ApiErrorCode.COMMON_CONFLICT,
                    "The guided turn needs a saved reader message"
                );
            }
            AiMessageResponse generated = sessionWindowBusiness.generateGuidedPersonaResponse(
                run.getWindowId(),
                request.getPersonaId(),
                structureSelection ? current.getQuestionText() : latestUserMessage.getContent(),
                structureSelection ? null : latestUserMessage.getId(),
                guide.getDepth()
            );
            DebateTurnResponse debate = transactionTemplate.execute(status -> {
                DebateTurnResponse result = structureSelection
                    ? sessionWindowBusiness.persistStandaloneGuidedPersonaResponse(
                        run.getWindowId(),
                        current.getQuestionId(),
                        request.getPersonaId(),
                        generated
                    )
                    : sessionWindowBusiness.persistGuidedPersonaResponse(
                        run.getWindowId(),
                        current.getQuestionId(),
                        request.getPersonaId(),
                        latestUserMessage,
                        generated
                    );
                updateClaimedPerspectiveProgress(run, "CALL_PERSPECTIVE", current, claimToken);
                return result;
            });
            return turnResponse(
                run,
                requireDebate(debate),
                "CALL_PERSPECTIVE",
                current,
                discussionDirector.next(items, current),
                List.of(),
                false
            );
        } catch (RuntimeException exception) {
            releasePerspectiveClaimSafely(run.getId(), currentUserId(), claimToken);
            throw exception;
        }
    }

    private GuidedDiscussionTurnResponse skipPerspective(
        DiscussionRunRecord run,
        List<DiscussionGuideItemRecord> items,
        DiscussionGuideItemRecord current
    ) {
        List<Long> pendingIds = parsePendingIds(run.getPendingPerspectiveIdsJson());
        if (!current.getId().equals(run.getPendingPerspectiveItemId()) || pendingIds.isEmpty()) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Perspective selection is no longer available"
            );
        }
        if (run.getLastDirectorAction() == null) {
            transactionTemplate.execute(status -> {
                run.setPendingPerspectiveItemId(null);
                run.setPendingPerspectiveIdsJson(null);
                run.setPendingPerspectiveClaimToken(null);
                run.setPendingPerspectiveClaimedAt(null);
                requireChanged(
                    discussionRunMapper.updateRunProgress(run),
                    "Discussion perspective choice could not be cleared"
                );
                return null;
            });
            return turnResponse(
                run,
                DebateTurnResponse.builder().messages(List.of()).build(),
                null,
                current,
                discussionDirector.next(items, current),
                List.of(),
                false
            );
        }
        DiscussionGuideItemRecord target = discussionDirector.next(items, current);
        String action = target == null ? "FINISH_DISCUSSION" : "MOVE_NEXT_TOPIC";
        transactionTemplate.execute(status -> {
            updateUnclaimedPerspectiveProgress(run, action, target, current.getId());
            return null;
        });
        DiscussionGuideItemRecord updatedCurrent = run.getCurrentItemId() == null
            ? null
            : discussionGuideMapper.findOwnedGuideItem(run.getCurrentItemId(), currentUserId());
        return turnResponse(
            run,
            DebateTurnResponse.builder().messages(List.of()).build(),
            action,
            updatedCurrent,
            discussionDirector.next(items, updatedCurrent),
            List.of(),
            false
        );
    }

    private String directorReply(
        DirectorDecision decision,
        DiscussionGuideItemRecord current
    ) {
        String generatedReply = decision.reply();
        if (generatedReply != null && !generatedReply.isBlank()) {
            return withFocus(generatedReply, decision.focus());
        }
        String action = decision.action();
        DiscussionGuideItemRecord target = decision.targetItem();
        return withFocus(switch (action) {
            case "ASK_FOLLOW_UP" -> "좋아요. 지금 답에서 가장 중요한 근거나 망설임을 한 문장만 더 구체화해 볼까요?";
            case "MOVE_NEXT_TOPIC" -> target == null
                ? "여기까지의 생각을 정리하고 토론을 마무리해 볼까요?"
                : "좋아요. 다음은 “" + target.getQuestionText() + "”를 살펴보겠습니다.";
            case "FINISH_DISCUSSION" -> "지금까지의 관점을 바탕으로 처음 Reflection을 유지하거나 다듬어 보세요.";
            case "SUMMARIZE_TOPIC" -> "이 주제에서 확인한 핵심은 무엇인지 한 문장으로 정리해 보겠습니다.";
            default -> null;
        }, decision.focus());
    }

    private String withFocus(String reply, String focus) {
        if (reply == null || focus == null || focus.isBlank()) {
            return reply;
        }
        return reply + "\n\n이번 쟁점: " + focus;
    }

    private void updateProgress(
        DiscussionRunRecord run,
        String action,
        DiscussionGuideItemRecord target,
        List<Long> pendingIds
    ) {
        applyProgress(run, action, target, pendingIds);
        requireChanged(discussionRunMapper.updateRunProgress(run), "Discussion progress could not be saved");
        if ("COMPLETED".equals(run.getStatus())) {
            discussionGuideMapper.updateGuideStatus(run.getGuideId(), currentUserId(), "COMPLETED");
        }
    }

    private void updateClaimedPerspectiveProgress(
        DiscussionRunRecord run,
        String action,
        DiscussionGuideItemRecord target,
        String claimToken
    ) {
        applyProgress(run, action, target, null);
        requireChanged(
            discussionRunMapper.completeClaimedPerspectiveProgress(
                run.getId(),
                currentUserId(),
                run.getCurrentItemId(),
                run.getStatus(),
                run.getLastDirectorAction(),
                claimToken
            ),
            "Discussion progress could not be saved"
        );
        if ("COMPLETED".equals(run.getStatus())) {
            discussionGuideMapper.updateGuideStatus(run.getGuideId(), currentUserId(), "COMPLETED");
        }
    }

    private void updateUnclaimedPerspectiveProgress(
        DiscussionRunRecord run,
        String action,
        DiscussionGuideItemRecord target,
        Long pendingItemId
    ) {
        applyProgress(run, action, target, null);
        requireChanged(
            discussionRunMapper.advanceUnclaimedPerspective(
                run.getId(),
                currentUserId(),
                run.getCurrentItemId(),
                run.getStatus(),
                run.getLastDirectorAction(),
                pendingItemId,
                perspectiveClaimTtlSeconds()
            ),
            "Perspective selection changed while it was being skipped"
        );
        if ("COMPLETED".equals(run.getStatus())) {
            discussionGuideMapper.updateGuideStatus(run.getGuideId(), currentUserId(), "COMPLETED");
        }
    }

    private void applyProgress(
        DiscussionRunRecord run,
        String action,
        DiscussionGuideItemRecord target,
        List<Long> pendingIds
    ) {
        run.setLastDirectorAction(action);
        run.setStatus("FINISH_DISCUSSION".equals(action) ? "COMPLETED" : "ACTIVE");
        run.setCurrentItemId(switch (action) {
            case "MOVE_NEXT_TOPIC" -> target == null ? null : target.getId();
            case "FINISH_DISCUSSION" -> null;
            default -> run.getCurrentItemId();
        });
        run.setPendingPerspectiveClaimToken(null);
        run.setPendingPerspectiveClaimedAt(null);
        if (pendingIds == null || pendingIds.isEmpty()) {
            run.setPendingPerspectiveItemId(null);
            run.setPendingPerspectiveIdsJson(null);
        } else {
            run.setPendingPerspectiveIdsJson(jsonIds(pendingIds));
        }
    }

    private boolean hasPendingPerspective(DiscussionRunRecord run) {
        return run.getPendingPerspectiveItemId() != null
            || !parsePendingIds(run.getPendingPerspectiveIdsJson()).isEmpty();
    }

    private int perspectiveClaimTtlSeconds() {
        return Math.max(30, properties.getPerspectiveClaimTtlSeconds());
    }

    private void releasePerspectiveClaimSafely(Long runId, Long userId, String claimToken) {
        try {
            transactionTemplate.execute(status -> {
                discussionRunMapper.releasePerspectiveClaim(runId, userId, claimToken);
                return null;
            });
        } catch (RuntimeException releaseException) {
            log.warn(
                "Could not release pending perspective claim. runId={}, error={}",
                runId,
                releaseException.getClass().getSimpleName()
            );
        }
    }

    private List<Long> boundedCandidates(List<Long> candidateIds) {
        if (candidateIds == null || candidateIds.isEmpty()) {
            return List.of();
        }
        Set<Long> activeIds = personaMapper.findActiveForUser(currentUserId()).stream()
            .map(PersonaRecord::getId)
            .collect(java.util.stream.Collectors.toSet());
        return candidateIds.stream()
            .filter(activeIds::contains)
            .limit(2)
            .toList();
    }

    private boolean isDiscussionStructure(ModerationEventRecord moderation) {
        return moderation != null && "DISCUSSION_STRUCTURE".equals(moderation.getIntent());
    }

    private List<Long> activePerspectiveIds() {
        return personaMapper.findActiveForUser(currentUserId()).stream()
            .map(PersonaRecord::getId)
            .limit(2)
            .toList();
    }

    private List<PerspectiveCandidateDto> candidateDtos(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Set<Long> requested = new LinkedHashSet<>(ids);
        return personaMapper.findActiveForUser(currentUserId()).stream()
            .filter(persona -> requested.contains(persona.getId()))
            .limit(2)
            .map(persona -> PerspectiveCandidateDto.builder()
                .personaId(persona.getId())
                .displayName(persona.getDisplayName())
                .description(persona.getDescription())
                .build())
            .toList();
    }

    private String jsonIds(List<Long> ids) {
        try {
            return objectMapper.writeValueAsString(ids);
        } catch (JsonProcessingException exception) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Perspective selection could not be prepared"
            );
        }
    }

    private List<Long> parsePendingIds(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                json,
                objectMapper.getTypeFactory().constructCollectionType(List.class, Long.class)
            );
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private DebateTurnResponse requireDebate(DebateTurnResponse debate) {
        if (debate == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Discussion turn could not be saved"
            );
        }
        return debate;
    }

    private String transcriptHash(List<MessageRecord> messages) {
        StringBuilder canonical = new StringBuilder();
        for (MessageRecord message : messages) {
            appendHashField(canonical, message.getId());
            appendHashField(canonical, message.getMessageOrder());
            appendHashField(canonical, message.getRole());
            appendHashField(canonical, message.getPersonaId());
            appendHashField(canonical, message.getQuestionId());
            appendHashField(canonical, message.getContent());
        }
        return sha256(canonical.toString());
    }

    private void appendHashField(StringBuilder canonical, Object value) {
        String normalized = value == null ? "" : String.valueOf(value);
        canonical.append(normalized.length()).append(':').append(normalized).append('|');
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String generationMetadataJson(AiGenerationResult<String> generation) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("taskType", generation.taskType());
        metadata.put("provider", generation.provider());
        metadata.put("model", generation.model());
        metadata.put("promptVersion", generation.promptVersion());
        metadata.put("schemaVersion", generation.schemaVersion());
        metadata.put("inputTokens", generation.inputTokens());
        metadata.put("cachedInputTokens", generation.cachedInputTokens());
        metadata.put("outputTokens", generation.outputTokens());
        metadata.put("latencyMs", generation.latencyMs());
        metadata.put("outcome", generation.outcome());
        metadata.put("fallbackUsed", generation.fallbackUsed());
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException exception) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Reflection refinement metadata could not be serialized"
            );
        }
    }

    private long currentUserId() {
        return AuthContext.requireUserId();
    }

    private void requireChanged(int changed, String reason) {
        if (changed <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
        }
    }

    private record RefinementPreparation(
        DiscussionRunRecord run,
        DiscussionGuideRecord guide,
        String initialContent,
        String currentContent,
        String perspectiveSummary,
        String inputHash,
        boolean generate
    ) {
    }
}
