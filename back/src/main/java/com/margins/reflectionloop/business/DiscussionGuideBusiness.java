package com.margins.reflectionloop.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.support.AuthContext;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.ReflectionLoopProperties;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideBrief;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideDraft;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.SourceDraft;
import com.margins.reflectionloop.business.DiscussionGuideVersionPolicy.VersionContent;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.DiscussionRunMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.DiscussionRunRecord;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.reflectionloop.model.dto.request.EditDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.GuideBriefRequest;
import com.margins.reflectionloop.model.dto.request.RegenerateDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideVersionSummary;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideVersionsResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionQuestionDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
public class DiscussionGuideBusiness {
    private final ReflectionBusiness reflectionBusiness;
    private final ReflectionInterviewBusiness interviewBusiness;
    private final ReflectionLoopProperties properties;
    private final ReflectionRevisionMapper reflectionRevisionMapper;
    private final DiscussionGuideMapper discussionGuideMapper;
    private final DiscussionRunMapper discussionRunMapper;
    private final DiscussionGuideGenerator guideGenerator;
    private final ReflectionEvidenceCatalog evidenceCatalog;
    private final DiscussionGuideVersionPolicy versionPolicy;
    private final DiscussionGuideVersionWriter versionWriter;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final GenerationLocaleResolver generationLocaleResolver;

    public DiscussionGuideResponse create(Long interviewId, GuideBriefRequest request) {
        GuideBrief brief = versionPolicy.brief(request);
        InitialPreparation preparation = transactionTemplate.execute(
            status -> prepareInitial(interviewId, brief)
        );
        if (preparation == null) {
            throw internal("Discussion guide preparation failed");
        }
        if (preparation.existing() != null) {
            return response(preparation.existing());
        }
        GuideDraft draft = generate(
            preparation.sources(), preparation.interview(), brief, preparation.generationLocale()
        );
        try {
            DiscussionGuideRecord guide = transactionTemplate.execute(
                status -> persistInitial(preparation, draft)
            );
            if (guide == null) {
                throw internal("Discussion guide could not be saved");
            }
            return response(guide);
        } catch (DataIntegrityViolationException exception) {
            DiscussionGuideRecord concurrent = discussionGuideMapper.findCurrentGuideByInterview(
                interviewId,
                currentUserId()
            );
            if (concurrent != null) {
                return response(concurrent);
            }
            throw exception;
        }
    }

    public DiscussionGuideResponse edit(Long guideId, EditDiscussionGuideRequest request) {
        DiscussionGuideRecord guide = transactionTemplate.execute(
            status -> editInTransaction(guideId, request)
        );
        if (guide == null) {
            throw internal("Discussion guide edit could not be saved");
        }
        return response(guide);
    }

    public DiscussionGuideResponse regenerate(
        Long guideId,
        RegenerateDiscussionGuideRequest request
    ) {
        GuideBrief brief = versionPolicy.brief(request == null ? null : request.getBrief());
        RegenerationPreparation preparation = transactionTemplate.execute(
            status -> prepareRegeneration(guideId, request, brief)
        );
        if (preparation == null) {
            throw internal("Discussion guide regeneration preparation failed");
        }
        GuideDraft draft = generate(
            preparation.sources(), preparation.interview(), brief, preparation.generationLocale()
        );
        DiscussionGuideRecord guide = transactionTemplate.execute(
            status -> persistRegeneration(preparation, draft)
        );
        if (guide == null) {
            throw internal("Discussion guide regeneration could not be saved");
        }
        return response(guide);
    }

    public DiscussionGuideResponse get(Long guideId) {
        reflectionBusiness.requireEnabled();
        return response(requireGuide(guideId));
    }

    public DiscussionGuideVersionsResponse versions(Long interviewId) {
        reflectionBusiness.requireEnabled();
        interviewBusiness.requireInterview(interviewId);
        List<DiscussionGuideRecord> versions = discussionGuideMapper.findGuideVersionsByInterview(
            interviewId,
            currentUserId()
        );
        DiscussionGuideRecord current = versions.stream()
            .filter(guide -> Boolean.TRUE.equals(guide.getIsCurrent()))
            .findFirst()
            .orElse(null);
        return DiscussionGuideVersionsResponse.builder()
            .interviewId(interviewId)
            .currentGuideId(current == null ? null : current.getId())
            .versions(versions.stream().map(this::versionSummary).toList())
            .build();
    }

    public DiscussionGuideRecord requireGuide(Long guideId) {
        DiscussionGuideRecord guide = discussionGuideMapper.findOwnedGuide(guideId, currentUserId());
        if (guide == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Discussion guide not found");
        }
        return guide;
    }

    public DiscussionGuideRecord requireGuideForUpdate(Long guideId) {
        if (discussionGuideMapper.lockOwnedGuide(guideId, currentUserId()) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Discussion guide not found");
        }
        return requireGuide(guideId);
    }

    public DiscussionQuestionDto itemDto(DiscussionGuideItemRecord item) {
        if (item == null) {
            return null;
        }
        boolean privateSource = "ANSWER".equals(item.getSourceType());
        return DiscussionQuestionDto.builder()
            .itemId(item.getId())
            .questionId(item.getQuestionId())
            .stage(item.getStage())
            .priority(item.getPriority())
            .order(item.getItemOrder())
            .question(item.getQuestionText())
            .intent(item.getIntent())
            .sourceType(item.getSourceType())
            .sourceRefId(item.getSourceRefId())
            .sourceExcerpt(privateSource ? null : item.getSourceExcerpt())
            .sourceVersion(item.getSourceVersion())
            .sourceStale(item.isSourceStale())
            .sourceFallback(item.isSourceFallback())
            .privateSource(privateSource)
            .sensitivity(item.getSensitivity())
            .skippable(item.isSkippable())
            .expectedMinutes(item.getExpectedMinutes())
            .followUps(readStringList(item.getFollowUpsJson()))
            .build();
    }

    private InitialPreparation prepareInitial(Long interviewId, GuideBrief brief) {
        reflectionBusiness.requireEnabled();
        ReflectionInterviewRecord interview = interviewBusiness.requireInterviewForUpdate(interviewId);
        requireGuideEligible(interview);
        DiscussionGuideRecord existing = discussionGuideMapper.findCurrentGuideByInterview(
            interviewId,
            currentUserId()
        );
        if (existing != null) {
            return new InitialPreparation(interview, null, List.of(), existing, brief, null);
        }
        ReflectionRevisionRecord revision = requireRevision(interview);
        GenerationLocale generationLocale = generationLocaleResolver.resolve(interview.getUserId());
        return new InitialPreparation(
            interview,
            revision,
            sources(interview, revision, brief.disclosureMode(), generationLocale),
            null,
            brief,
            generationLocale
        );
    }

    private DiscussionGuideRecord persistInitial(
        InitialPreparation preparation,
        GuideDraft draft
    ) {
        ReflectionInterviewRecord interview = interviewBusiness.requireInterviewForUpdate(
            preparation.interview().getId()
        );
        requireGuideWritable(interview);
        DiscussionGuideRecord existing = discussionGuideMapper.findCurrentGuideByInterview(
            interview.getId(),
            currentUserId()
        );
        if (existing != null) {
            return existing;
        }
        requireSameInterviewSnapshot(interview, preparation.interview(), preparation.revision());
        return versionWriter.insertInitial(
            interview,
            preparation.brief(),
            versionPolicy.generatedContent(draft),
            properties.getGuidePromptVersion(),
            depth(interview.getAnsweredCount()),
            currentUserId()
        );
    }

    private RegenerationPreparation prepareRegeneration(
        Long guideId,
        RegenerateDiscussionGuideRequest request,
        GuideBrief brief
    ) {
        reflectionBusiness.requireEnabled();
        if (request == null || request.getExpectedVersion() == null) {
            throw badRequest("Guide expected version is required");
        }
        DiscussionGuideRecord visible = requireGuide(guideId);
        ReflectionInterviewRecord interview = interviewBusiness.requireInterviewForUpdate(
            visible.getInterviewId()
        );
        DiscussionGuideRecord source = requireGuideForUpdate(guideId);
        requireCurrentSource(interview, source, request.getExpectedVersion());
        requireGuideEligible(interview);
        ReflectionRevisionRecord revision = requireRevision(interview);
        GenerationLocale generationLocale = generationLocaleResolver.resolve(interview.getUserId());
        return new RegenerationPreparation(
            interview,
            revision,
            sources(interview, revision, brief.disclosureMode(), generationLocale),
            source,
            brief,
            generationLocale
        );
    }

    private DiscussionGuideRecord persistRegeneration(
        RegenerationPreparation preparation,
        GuideDraft draft
    ) {
        ReflectionInterviewRecord interview = interviewBusiness.requireInterviewForUpdate(
            preparation.interview().getId()
        );
        requireGuideWritable(interview);
        DiscussionGuideRecord source = requireGuideForUpdate(preparation.source().getId());
        requireCurrentSource(interview, source, preparation.source().getGuideVersion());
        requireSameInterviewSnapshot(interview, preparation.interview(), preparation.revision());
        return versionWriter.replaceCurrent(
            interview,
            source,
            "REGENERATED",
            preparation.brief(),
            versionPolicy.generatedContent(draft),
            properties.getGuidePromptVersion(),
            depth(interview.getAnsweredCount()),
            currentUserId()
        );
    }

    private DiscussionGuideRecord editInTransaction(
        Long guideId,
        EditDiscussionGuideRequest request
    ) {
        reflectionBusiness.requireEnabled();
        if (request == null || request.getExpectedVersion() == null) {
            throw badRequest("Guide expected version is required");
        }
        DiscussionGuideRecord visible = requireGuide(guideId);
        ReflectionInterviewRecord interview = interviewBusiness.requireInterviewForUpdate(
            visible.getInterviewId()
        );
        requireGuideWritable(interview);
        DiscussionGuideRecord source = requireGuideForUpdate(guideId);
        requireCurrentSource(interview, source, request.getExpectedVersion());
        VersionContent content = versionPolicy.editedContent(
            source,
            discussionGuideMapper.findGuideItems(source.getId(), currentUserId()),
            request
        );
        return versionWriter.replaceCurrent(
            interview,
            source,
            "USER_EDIT",
            new GuideBrief(
                source.getPurpose(),
                source.getAudienceMode(),
                source.getTargetMinutes(),
                source.getDisclosureMode(),
                source.getFacilitationLevel()
            ),
            content,
            source.getPromptVersion(),
            depth(interview.getAnsweredCount()),
            currentUserId()
        );
    }

    private GuideDraft generate(
        List<SourceDraft> sources,
        ReflectionInterviewRecord interview,
        GuideBrief brief,
        GenerationLocale generationLocale
    ) {
        try {
            return guideGenerator.generate(
                interview.getWindowId(),
                properties.getGuidePromptVersion(),
                sources,
                brief,
                depth(interview.getAnsweredCount()),
                interview.isTestData(),
                generationLocale
            );
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(
                ApiErrorCode.COMMON_UPSTREAM_ERROR,
                "Discussion guide generation failed",
                exception
            );
        }
    }

    private List<SourceDraft> sources(
        ReflectionInterviewRecord interview,
        ReflectionRevisionRecord revision,
        String disclosureMode,
        GenerationLocale generationLocale
    ) {
        boolean includePrivateAnswers = !"REFLECTION_ONLY".equals(disclosureMode);
        return evidenceCatalog.load(
            interview, revision, includePrivateAnswers, generationLocale
        )
            .all()
            .stream()
            .map(source -> new SourceDraft(
                source.alias(),
                source.type(),
                source.refId(),
                source.excerpt(),
                source.version(),
                source.stale(),
                source.fallback()
            ))
            .toList();
    }

    private DiscussionGuideResponse response(DiscussionGuideRecord guide) {
        List<DiscussionGuideItemRecord> items = discussionGuideMapper.findGuideItems(
            guide.getId(),
            currentUserId()
        );
        DiscussionRunRecord run = discussionRunMapper.findRunByGuide(guide.getId(), currentUserId());
        DiscussionGuideRecord current = discussionGuideMapper.findCurrentGuideByInterview(
            guide.getInterviewId(),
            currentUserId()
        );
        return DiscussionGuideResponse.builder()
            .guideId(guide.getId())
            .reflectionId(guide.getReflectionInsightId())
            .interviewId(guide.getInterviewId())
            .sessionId(guide.getSessionId())
            .depth(guide.getDepth())
            .purpose(guide.getPurpose())
            .facilitationLevel(guide.getFacilitationLevel())
            .audienceMode(guide.getAudienceMode())
            .targetMinutes(guide.getTargetMinutes())
            .disclosureMode(guide.getDisclosureMode())
            .goal(guide.getGoal())
            .issues(readStringList(guide.getIssuesJson()))
            .status(guide.getStatus())
            .guideVersion(guide.getGuideVersion())
            .sourceGuideId(guide.getSourceGuideId())
            .origin(guide.getOrigin())
            .current(Boolean.TRUE.equals(guide.getIsCurrent()))
            .currentGuideId(current == null ? null : current.getId())
            .items(items.stream().map(this::itemDto).toList())
            .runId(run == null ? null : run.getId())
            .build();
    }

    private DiscussionGuideVersionSummary versionSummary(DiscussionGuideRecord guide) {
        return DiscussionGuideVersionSummary.builder()
            .guideId(guide.getId())
            .guideVersion(guide.getGuideVersion())
            .origin(guide.getOrigin())
            .status(guide.getStatus())
            .current(Boolean.TRUE.equals(guide.getIsCurrent()))
            .hasRun(Boolean.TRUE.equals(guide.getHasRun()))
            .createdAt(guide.getCreatedAt())
            .build();
    }

    private void requireCurrentSource(
        ReflectionInterviewRecord interview,
        DiscussionGuideRecord source,
        Integer expectedVersion
    ) {
        DiscussionGuideRecord current = discussionGuideMapper.findCurrentGuideByInterview(
            interview.getId(),
            currentUserId()
        );
        if (!Boolean.TRUE.equals(source.getIsCurrent())
            || !source.getInterviewId().equals(interview.getId())
            || !source.getGuideVersion().equals(expectedVersion)
            || current == null
            || !current.getId().equals(source.getId())) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Discussion guide changed before this version was saved"
            );
        }
    }

    private void requireSameInterviewSnapshot(
        ReflectionInterviewRecord current,
        ReflectionInterviewRecord prepared,
        ReflectionRevisionRecord revision
    ) {
        if (!current.getSourceRevisionId().equals(revision.getId())
            || current.getAnsweredCount() != prepared.getAnsweredCount()) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Interview changed while the guide was generated"
            );
        }
    }

    private void requireGuideEligible(ReflectionInterviewRecord interview) {
        requireGuideWritable(interview);
        if (interview.getAnsweredCount() < ReflectionInterviewBusiness.MINIMUM_ANSWERS) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "At least three answers are required"
            );
        }
    }

    private void requireGuideWritable(ReflectionInterviewRecord interview) {
        if (!"ACTIVE".equals(interview.getStatus()) && !"GUIDE_READY".equals(interview.getStatus())) {
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Discussion guide lineage is read-only"
            );
        }
    }

    private ReflectionRevisionRecord requireRevision(ReflectionInterviewRecord interview) {
        ReflectionRevisionRecord revision = reflectionRevisionMapper.findOwnedRevision(
            interview.getSourceRevisionId(),
            currentUserId()
        );
        if (revision == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Guide source revision not found");
        }
        return revision;
    }

    private String depth(int answeredCount) {
        if (answeredCount <= 3) {
            return "SIMPLE";
        }
        if (answeredCount <= 5) {
            return "STANDARD";
        }
        return "DEEP";
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() { });
        } catch (JsonProcessingException exception) {
            throw internal("Guide JSON is invalid");
        }
    }

    private long currentUserId() {
        return AuthContext.requireUserId();
    }

    private ApiException badRequest(String reason) {
        return new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, reason);
    }

    private ApiException internal(String reason) {
        return new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
    }

    private record InitialPreparation(
        ReflectionInterviewRecord interview,
        ReflectionRevisionRecord revision,
        List<SourceDraft> sources,
        DiscussionGuideRecord existing,
        GuideBrief brief,
        GenerationLocale generationLocale
    ) {
    }

    private record RegenerationPreparation(
        ReflectionInterviewRecord interview,
        ReflectionRevisionRecord revision,
        List<SourceDraft> sources,
        DiscussionGuideRecord source,
        GuideBrief brief,
        GenerationLocale generationLocale
    ) {
    }

}
