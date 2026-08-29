package com.margins.reflectionloop.business;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideBrief;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideDraft;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.dto.request.EditDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.GuideBriefRequest;
import com.margins.reflectionloop.model.dto.request.GuideItemEditRequest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Validates Guide briefs and immutable version content without persistence dependencies.
 */
@Component
public class DiscussionGuideVersionPolicy {
    private static final List<String> REQUIRED_STAGE_ORDER = List.of(
        "WARM_UP",
        "INTERPRETATION",
        "EXPERIENCE",
        "SOCIAL_VALUE",
        "CLOSING"
    );
    private static final Set<String> PURPOSES = Set.of(
        "THOUGHT_EXPANSION",
        "ISSUE_EXPLORATION",
        "DISCUSSION_PREP"
    );
    private static final Set<String> AUDIENCE_MODES = Set.of("SELF_AI", "SMALL_GROUP");
    private static final Set<Integer> TARGET_MINUTES = Set.of(20, 40, 60);
    private static final Set<String> DISCLOSURE_MODES = Set.of(
        "PRIVATE_CONTEXT",
        "REFLECTION_ONLY"
    );
    private static final Set<String> FACILITATION_LEVELS = Set.of(
        "BEGINNER",
        "EXPERIENCED",
        "EXPERT"
    );

    GuideBrief brief(GuideBriefRequest request) {
        String facilitationLevel = request == null || request.getFacilitationLevel() == null
            ? "BEGINNER"
            : request.getFacilitationLevel();
        if (request == null
            || request.getPurpose() == null
            || request.getAudienceMode() == null
            || request.getTargetMinutes() == null
            || request.getDisclosureMode() == null
            || !PURPOSES.contains(request.getPurpose())
            || !AUDIENCE_MODES.contains(request.getAudienceMode())
            || !TARGET_MINUTES.contains(request.getTargetMinutes())
            || !DISCLOSURE_MODES.contains(request.getDisclosureMode())
            || !FACILITATION_LEVELS.contains(facilitationLevel)) {
            throw badRequest("Discussion Guide brief is invalid");
        }
        return new GuideBrief(
            request.getPurpose(),
            request.getAudienceMode(),
            request.getTargetMinutes(),
            request.getDisclosureMode(),
            facilitationLevel
        );
    }

    VersionContent generatedContent(GuideDraft draft) {
        return new VersionContent(
            draft.goal(),
            draft.issues(),
            draft.items().stream()
                .map(item -> new VersionItem(
                    item.stage(),
                    item.priority(),
                    item.question(),
                    item.intent(),
                    item.source().type(),
                    item.source().refId(),
                    item.source().excerpt(),
                    item.source().version(),
                    item.source().stale(),
                    item.source().fallback(),
                    item.sensitivity(),
                    item.skippable(),
                    item.expectedMinutes(),
                    item.followUps()
                ))
                .toList(),
            draft.model(),
            draft.tokenUsageJson(),
            draft.generationMetadataJson(),
            draft.generationLocale(),
            draft.languageValidationOutcome()
        );
    }

    VersionContent editedContent(
        DiscussionGuideRecord source,
        List<DiscussionGuideItemRecord> sourceItems,
        EditDiscussionGuideRequest request
    ) {
        String goal = boundedRequired(request.getGoal(), "goal", 500);
        List<String> issues = request.getIssues() == null
            ? List.of()
            : request.getIssues().stream()
                .map(issue -> boundedRequired(issue, "issue", 500))
                .toList();
        if (issues.size() < 2 || issues.size() > 4) {
            throw badRequest("Guide requires two to four issues");
        }
        List<GuideItemEditRequest> requested = request.getItems() == null
            ? List.of()
            : request.getItems();
        if (requested.size() != sourceItems.size() || requested.size() < 5 || requested.size() > 8) {
            throw badRequest("Guide edit must include every item");
        }
        Map<Long, DiscussionGuideItemRecord> sourceById = new HashMap<>();
        sourceItems.forEach(item -> sourceById.put(item.getId(), item));
        Set<Long> seenIds = new HashSet<>();
        Set<String> seenQuestions = new HashSet<>();
        List<String> requiredOrder = new ArrayList<>();
        List<VersionItem> items = new ArrayList<>();
        for (GuideItemEditRequest item : requested) {
            if (item == null || item.getItemId() == null || !seenIds.add(item.getItemId())) {
                throw badRequest("Guide edit item identity is invalid");
            }
            DiscussionGuideItemRecord original = sourceById.get(item.getItemId());
            if (original == null) {
                throw badRequest("Guide edit item does not belong to the source Guide");
            }
            String question = boundedRequired(item.getQuestion(), "question", 1000);
            String normalized = question.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
            if (!seenQuestions.add(normalized)) {
                throw badRequest("Guide questions must be distinct");
            }
            String intent = boundedRequired(item.getIntent(), "intent", 1000);
            int expectedMinutes = item.getExpectedMinutes() == null ? 0 : item.getExpectedMinutes();
            if (expectedMinutes < 1 || expectedMinutes > 20) {
                throw badRequest("Guide expected minutes are invalid");
            }
            List<String> followUps = item.getFollowUps() == null
                ? List.of()
                : item.getFollowUps().stream()
                    .map(value -> boundedRequired(value, "follow-up", 1000))
                    .toList();
            if (followUps.size() > 2) {
                throw badRequest("Guide follow-ups exceed the limit");
            }
            if ("REQUIRED".equals(original.getPriority())) {
                requiredOrder.add(original.getStage());
            }
            items.add(new VersionItem(
                original.getStage(),
                original.getPriority(),
                question,
                intent,
                original.getSourceType(),
                original.getSourceRefId(),
                original.getSourceExcerpt(),
                original.getSourceVersion(),
                original.isSourceStale(),
                original.isSourceFallback(),
                original.getSensitivity(),
                original.isSkippable(),
                expectedMinutes,
                followUps
            ));
        }
        if (seenIds.size() != sourceItems.size() || !REQUIRED_STAGE_ORDER.equals(requiredOrder)) {
            throw badRequest("Guide required stages are out of order");
        }
        int totalMinutes = items.stream().mapToInt(VersionItem::expectedMinutes).sum();
        if (totalMinutes != source.getTargetMinutes()) {
            throw badRequest("Guide item minutes must equal the target minutes");
        }
        return new VersionContent(
            goal,
            issues,
            List.copyOf(items),
            source.getModel(),
            source.getTokenUsageJson(),
            source.getGenerationMetadataJson(),
            null,
            null
        );
    }

    private String boundedRequired(String value, String field, int max) {
        String safe = value == null ? "" : value.trim();
        if (safe.isBlank() || safe.length() > max) {
            throw badRequest("Discussion Guide " + field + " is invalid");
        }
        return safe;
    }

    private ApiException badRequest(String reason) {
        return new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, reason);
    }

    record VersionContent(
        String goal,
        List<String> issues,
        List<VersionItem> items,
        String model,
        String tokenUsageJson,
        String generationMetadataJson,
        String generationLocale,
        String languageValidationOutcome
    ) {
    }

    record VersionItem(
        String stage,
        String priority,
        String question,
        String intent,
        String sourceType,
        Long sourceRefId,
        String sourceExcerpt,
        String sourceVersion,
        boolean sourceStale,
        boolean sourceFallback,
        String sensitivity,
        boolean skippable,
        int expectedMinutes,
        List<String> followUps
    ) {
    }
}
