package com.margins.reflectionloop.business;

import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.ReflectionLoopProperties;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.DiscussionRunMapper;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.DiscussionRunRecord;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRequest;
import com.margins.reflectionloop.model.dto.response.ReflectionLoopResponse;
import com.margins.reflectionloop.model.dto.response.RevisionDto;
import com.margins.session.mapper.SessionInsightMapper;
import com.margins.session.model.SessionInsightRecord;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReflectionBusiness {
    private final ReflectionLoopProperties properties;
    private final ReflectionRevisionMapper reflectionRevisionMapper;
    private final ReflectionInterviewMapper reflectionInterviewMapper;
    private final DiscussionGuideMapper discussionGuideMapper;
    private final DiscussionRunMapper discussionRunMapper;
    private final SessionInsightMapper sessionInsightMapper;

    public ReflectionLoopResponse create(Long sessionId, SaveReflectionRequest request) {
        requireEnabled();
        long userId = currentUserId();
        if (reflectionRevisionMapper.lockOwnedSession(sessionId, userId) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reading session not found");
        }
        if (reflectionRevisionMapper.findPrimaryReflection(sessionId, userId) != null) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Primary Reflection already exists");
        }

        SessionInsightRecord reflection = SessionInsightRecord.builder()
            .sessionId(sessionId)
            .userId(userId)
            .insightType("reflection")
            .title(defaultTitle(request.getTitle()))
            .content(request.getContent().trim())
            .evidence(trimToNull(request.getEvidence()))
            .authorName(trimToNull(request.getAuthorName()))
            .visibility(normalizeVisibility(request.getVisibility()))
            .reviewedOn(parseDate(request.getReviewedOn()))
            .insightOrder(sessionInsightMapper.selectNextOrder(sessionId))
            .testData(true)
            .build();
        requireChanged(sessionInsightMapper.insert(reflection), "Reflection could not be saved");
        insertRevision(reflection, reflection.getContent(), "INITIAL", null);
        return response(reflection);
    }

    public ReflectionLoopResponse get(Long reflectionId) {
        requireEnabled();
        return response(requirePrimaryReflection(reflectionId));
    }

    public ReflectionLoopResponse getPrimaryBySession(Long sessionId) {
        requireEnabled();
        SessionInsightRecord reflection = reflectionRevisionMapper.findPrimaryReflection(
            sessionId,
            currentUserId()
        );
        if (reflection == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_NOT_FOUND,
                "Primary Reflection was not found for the owned reading session",
                "아직 작성된 Reflection이 없어. 지금의 생각을 먼저 적어 저장해줘."
            );
        }
        return response(reflection);
    }

    public ReflectionLoopResponse update(Long reflectionId, SaveReflectionRequest request) {
        requireEnabled();
        SessionInsightRecord reflection = requirePrimaryReflectionForUpdate(reflectionId);
        appendRevision(
            reflection,
            request.getContent().trim(),
            "USER_EDIT",
            currentRevision(reflection.getId()).getId(),
            request
        );
        return response(requireReflection(reflectionId));
    }

    public ReflectionRevisionRecord appendDiscussionRevision(
        Long reflectionId,
        Long sourceRevisionId,
        String finalContent
    ) {
        SessionInsightRecord reflection = requirePrimaryReflectionForUpdate(reflectionId);
        SaveReflectionRequest metadata = SaveReflectionRequest.builder()
            .content(finalContent)
            .title(reflection.getTitle())
            .evidence(reflection.getEvidence())
            .authorName(reflection.getAuthorName())
            .visibility(reflection.getVisibility())
            .reviewedOn(reflection.getReviewedOn() == null ? null : reflection.getReviewedOn().toString())
            .build();
        return appendRevision(
            reflection,
            finalContent.trim(),
            "DISCUSSION_REFINE",
            sourceRevisionId,
            metadata
        );
    }

    public ReflectionLoopResponse createLegacy(Long sessionId, SaveReflectionRequest request) {
        return create(sessionId, request);
    }

    public ReflectionLoopResponse updateLegacy(
        Long sessionId,
        Long reflectionId,
        SaveReflectionRequest request
    ) {
        SessionInsightRecord reflection = requireReflection(reflectionId);
        if (!reflection.getSessionId().equals(sessionId)) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reflection not found");
        }
        return update(reflectionId, request);
    }

    public SessionInsightRecord requireReflection(Long reflectionId) {
        SessionInsightRecord reflection = reflectionRevisionMapper.findOwnedReflection(
            reflectionId,
            currentUserId()
        );
        if (reflection == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reflection not found");
        }
        return reflection;
    }

    public SessionInsightRecord requirePrimaryReflection(Long reflectionId) {
        SessionInsightRecord reflection = requireReflection(reflectionId);
        SessionInsightRecord primary = reflectionRevisionMapper.findPrimaryReflection(
            reflection.getSessionId(),
            currentUserId()
        );
        if (primary == null || !reflectionId.equals(primary.getId())) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Reflection is not the primary session Reflection");
        }
        return reflection;
    }

    public SessionInsightRecord requirePrimaryReflectionForUpdate(Long reflectionId) {
        SessionInsightRecord reflection = requireReflection(reflectionId);
        if (reflectionRevisionMapper.lockOwnedSession(reflection.getSessionId(), currentUserId()) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reading session not found");
        }
        return requirePrimaryReflection(reflectionId);
    }

    public ReflectionRevisionRecord currentRevision(Long reflectionId) {
        List<ReflectionRevisionRecord> revisions = reflectionRevisionMapper.findRevisions(
            reflectionId,
            currentUserId()
        );
        if (revisions.isEmpty()) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reflection revision not found");
        }
        return revisions.get(0);
    }

    public void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reflection Loop is disabled");
        }
    }

    private ReflectionRevisionRecord appendRevision(
        SessionInsightRecord reflection,
        String content,
        String source,
        Long sourceRevisionId,
        SaveReflectionRequest request
    ) {
        ReflectionRevisionRecord current = currentRevision(reflection.getId());
        ReflectionRevisionRecord revision = current;
        if (!current.getContent().equals(content)) {
            revision = insertRevision(reflection, content, source, sourceRevisionId);
        }
        requireChanged(reflectionRevisionMapper.updateReflectionProjection(
            reflection.getId(),
            reflection.getSessionId(),
            currentUserId(),
            defaultTitle(request.getTitle()),
            content,
            trimToNull(request.getEvidence()),
            trimToNull(request.getAuthorName()),
            normalizeVisibility(request.getVisibility()),
            parseDate(request.getReviewedOn())
        ), "Reflection projection could not be updated");
        return revision;
    }

    private ReflectionRevisionRecord insertRevision(
        SessionInsightRecord reflection,
        String content,
        String source,
        Long sourceRevisionId
    ) {
        ReflectionRevisionRecord revision = ReflectionRevisionRecord.builder()
            .reflectionInsightId(reflection.getId())
            .sessionId(reflection.getSessionId())
            .userId(reflection.getUserId())
            .version(reflectionRevisionMapper.nextRevisionVersion(reflection.getId()))
            .content(content)
            .revisionSource(source)
            .sourceRevisionId(sourceRevisionId)
            .testData(reflection.isTestData())
            .build();
        requireChanged(reflectionRevisionMapper.insertRevision(revision), "Reflection revision could not be saved");
        return revision;
    }

    private ReflectionLoopResponse response(SessionInsightRecord reflection) {
        List<ReflectionRevisionRecord> revisions = reflectionRevisionMapper.findRevisions(
            reflection.getId(),
            currentUserId()
        );
        ReflectionRevisionRecord current = revisions.isEmpty() ? null : revisions.get(0);
        ReflectionInterviewRecord interview = current == null ? null
            : reflectionInterviewMapper.findActiveInterviewByRevision(current.getId(), currentUserId());
        DiscussionGuideRecord guide = interview == null ? null
            : discussionGuideMapper.findCurrentGuideByInterview(interview.getId(), currentUserId());
        DiscussionRunRecord run = interview == null ? null
            : discussionRunMapper.findLatestRunByInterview(interview.getId(), currentUserId());
        return ReflectionLoopResponse.builder()
            .reflectionId(reflection.getId())
            .sessionId(reflection.getSessionId())
            .visibility(reflection.getVisibility())
            .currentRevision(current == null ? null : toRevisionDto(current))
            .revisions(revisions.stream().map(this::toRevisionDto).toList())
            .activeInterviewId(interview == null ? null : interview.getId())
            .guideId(guide == null ? null : guide.getId())
            .runId(run == null ? null : run.getId())
            .runStatus(run == null ? null : run.getStatus())
            .build();
    }

    private RevisionDto toRevisionDto(ReflectionRevisionRecord revision) {
        return RevisionDto.builder()
            .revisionId(revision.getId())
            .version(revision.getVersion())
            .content(revision.getContent())
            .revisionSource(revision.getRevisionSource())
            .sourceRevisionId(revision.getSourceRevisionId())
            .createdAt(revision.getCreatedAt())
            .build();
    }

    private long currentUserId() {
        return AuthContext.requireUserId();
    }

    private String normalizeVisibility(String visibility) {
        return "PUBLIC".equalsIgnoreCase(visibility) ? "PUBLIC" : "PRIVATE";
    }

    private String defaultTitle(String title) {
        String trimmed = trimToNull(title);
        return trimmed == null ? "Reflection" : trimmed;
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException exception) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "reviewedOn must be ISO date");
        }
    }

    private void requireChanged(int changed, String reason) {
        if (changed <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
        }
    }
}
