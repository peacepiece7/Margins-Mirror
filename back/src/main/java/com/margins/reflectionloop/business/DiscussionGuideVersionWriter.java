package com.margins.reflectionloop.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideBrief;
import com.margins.reflectionloop.business.DiscussionGuideVersionPolicy.VersionContent;
import com.margins.reflectionloop.business.DiscussionGuideVersionPolicy.VersionItem;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Writes one immutable Guide version and its linked question/item identities in the caller transaction.
 */
@Component
@RequiredArgsConstructor
public class DiscussionGuideVersionWriter {
    private final DiscussionGuideMapper discussionGuideMapper;
    private final ReflectionInterviewMapper reflectionInterviewMapper;
    private final QuestionMapper questionMapper;
    private final ObjectMapper objectMapper;

    DiscussionGuideRecord insertInitial(
        ReflectionInterviewRecord interview,
        GuideBrief brief,
        VersionContent content,
        String promptVersion,
        String depth,
        long userId
    ) {
        return insertVersion(
            interview,
            null,
            1,
            "GENERATED",
            brief,
            content,
            promptVersion,
            depth,
            userId
        );
    }

    DiscussionGuideRecord replaceCurrent(
        ReflectionInterviewRecord interview,
        DiscussionGuideRecord source,
        String origin,
        GuideBrief brief,
        VersionContent content,
        String promptVersion,
        String depth,
        long userId
    ) {
        archive(source, userId);
        return insertVersion(
            interview,
            source,
            source.getGuideVersion() + 1,
            origin,
            brief,
            content,
            promptVersion,
            depth,
            userId
        );
    }

    private DiscussionGuideRecord insertVersion(
        ReflectionInterviewRecord interview,
        DiscussionGuideRecord source,
        int version,
        String origin,
        GuideBrief brief,
        VersionContent content,
        String promptVersion,
        String depth,
        long userId
    ) {
        DiscussionGuideRecord guide = DiscussionGuideRecord.builder()
            .reflectionInsightId(interview.getReflectionInsightId())
            .sourceRevisionId(interview.getSourceRevisionId())
            .interviewId(interview.getId())
            .sessionId(interview.getSessionId())
            .userId(userId)
            .depth(depth)
            .purpose(brief.purpose())
            .facilitationLevel(brief.facilitationLevel())
            .audienceMode(brief.audienceMode())
            .targetMinutes(brief.targetMinutes())
            .disclosureMode(brief.disclosureMode())
            .goal(content.goal())
            .issuesJson(writeJson(content.issues()))
            .status("READY")
            .promptVersion(promptVersion)
            .model(content.model())
            .tokenUsageJson(content.tokenUsageJson())
            .generationMetadataJson(content.generationMetadataJson())
            .guideVersion(version)
            .sourceGuideId(source == null ? null : source.getId())
            .origin(origin)
            .isCurrent(true)
            .testData(interview.isTestData())
            .build();
        requireChanged(discussionGuideMapper.insertGuide(guide), "Discussion guide could not be saved");

        int order = 1;
        for (VersionItem itemDraft : content.items()) {
            QuestionRecord question = QuestionRecord.builder()
                .sessionId(interview.getSessionId())
                .windowId(interview.getWindowId())
                .userId(userId)
                .reflectionInterviewId(interview.getId())
                .questionText(itemDraft.question())
                .questionType("discussion_guide")
                .sourceType(itemDraft.sourceType())
                .sourceRefId(itemDraft.sourceRefId())
                .sourceExcerpt(itemDraft.sourceExcerpt())
                .sourceVersion(itemDraft.sourceVersion())
                .sourceStale(itemDraft.sourceStale())
                .sourceFallback(itemDraft.sourceFallback())
                .sensitivity(itemDraft.sensitivity())
                .status("guide")
                .aiModel(content.model())
                .testData(interview.isTestData())
                .build();
            requireChanged(questionMapper.insert(question), "Guide question could not be saved");
            DiscussionGuideItemRecord item = DiscussionGuideItemRecord.builder()
                .guideId(guide.getId())
                .questionId(question.getId())
                .stage(itemDraft.stage())
                .priority(itemDraft.priority())
                .itemOrder(order++)
                .intent(itemDraft.intent())
                .sourceType(itemDraft.sourceType())
                .sourceRefId(itemDraft.sourceRefId())
                .sourceExcerpt(itemDraft.sourceExcerpt())
                .sourceVersion(itemDraft.sourceVersion())
                .sourceStale(itemDraft.sourceStale())
                .sourceFallback(itemDraft.sourceFallback())
                .sensitivity(itemDraft.sensitivity())
                .skippable(itemDraft.skippable())
                .expectedMinutes(itemDraft.expectedMinutes())
                .followUpsJson(writeJson(itemDraft.followUps()))
                .testData(interview.isTestData())
                .build();
            requireChanged(
                discussionGuideMapper.insertGuideItem(item),
                "Guide item could not be saved"
            );
        }
        interview.setStatus("GUIDE_READY");
        requireChanged(
            reflectionInterviewMapper.updateInterview(interview),
            "Interview could not be finalized"
        );
        return guide;
    }

    private void archive(DiscussionGuideRecord source, long userId) {
        requireChanged(
            discussionGuideMapper.archiveCurrentGuide(
                source.getId(),
                userId,
                source.getGuideVersion()
            ),
            "Discussion guide changed before it could be archived"
        );
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw internal("Guide could not be serialized");
        }
    }

    private void requireChanged(int changed, String reason) {
        if (changed <= 0) {
            throw internal(reason);
        }
    }

    private ApiException internal(String reason) {
        return new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
    }
}
