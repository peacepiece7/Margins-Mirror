package com.margins.reflectionloop.business;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideBrief;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideDraft;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideItemDraft;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.SourceDraft;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.reflectionloop.model.DiscussionGuideRecord;
import com.margins.reflectionloop.model.dto.request.EditDiscussionGuideRequest;
import com.margins.reflectionloop.model.dto.request.GuideBriefRequest;
import com.margins.reflectionloop.model.dto.request.GuideItemEditRequest;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DiscussionGuideVersionPolicyTest {
    private static final List<String> STAGES = List.of(
        "WARM_UP",
        "INTERPRETATION",
        "EXPERIENCE",
        "SOCIAL_VALUE",
        "CLOSING"
    );

    private final DiscussionGuideVersionPolicy policy = new DiscussionGuideVersionPolicy();

    @Test
    void validatesSupportedBriefAndRejectsUnsupportedTarget() {
        GuideBrief brief = policy.brief(GuideBriefRequest.builder()
            .purpose("THOUGHT_EXPANSION")
            .audienceMode("SELF_AI")
            .targetMinutes(40)
            .disclosureMode("PRIVATE_CONTEXT")
            .build());

        assertThat(brief).isEqualTo(new GuideBrief(
            "THOUGHT_EXPANSION",
            "SELF_AI",
            40,
            "PRIVATE_CONTEXT"
        ));
        assertThat(brief.facilitationLevel()).isEqualTo("BEGINNER");
        assertThat(policy.brief(GuideBriefRequest.builder()
            .purpose("THOUGHT_EXPANSION")
            .audienceMode("SELF_AI")
            .targetMinutes(40)
            .disclosureMode("PRIVATE_CONTEXT")
            .facilitationLevel(null)
            .build()).facilitationLevel()).isEqualTo("BEGINNER");
        assertBadRequest(() -> policy.brief(GuideBriefRequest.builder()
            .purpose("THOUGHT_EXPANSION")
            .audienceMode("SELF_AI")
            .targetMinutes(30)
            .disclosureMode("PRIVATE_CONTEXT")
            .build()));
    }

    @Test
    void mapsGeneratedDraftToVersionContentWithoutChangingEvidenceMetadata() {
        SourceDraft source = new SourceDraft(
            "BK1",
            "BOOK_KNOWLEDGE",
            91L,
            "근거",
            "book-knowledge-v2",
            true,
            true
        );
        GuideDraft draft = new GuideDraft(
            "목표",
            List.of("쟁점 1", "쟁점 2"),
            List.of(new GuideItemDraft(
                "WARM_UP",
                "REQUIRED",
                "질문",
                "의도",
                source,
                "LOW",
                false,
                8,
                List.of("후속")
            )),
            "openai",
            "model",
            "{\"totalTokens\":10}",
            "{\"outcome\":\"SUCCESS\"}"
        );

        var content = policy.generatedContent(draft);

        assertThat(content.goal()).isEqualTo("목표");
        assertThat(content.model()).isEqualTo("model");
        assertThat(content.items()).singleElement().satisfies(item -> {
            assertThat(item.sourceType()).isEqualTo("BOOK_KNOWLEDGE");
            assertThat(item.sourceRefId()).isEqualTo(91L);
            assertThat(item.sourceVersion()).isEqualTo("book-knowledge-v2");
            assertThat(item.sourceStale()).isTrue();
            assertThat(item.sourceFallback()).isTrue();
        });
    }

    @Test
    void validatesEditedContentAndCopiesImmutableSourceFields() {
        List<DiscussionGuideItemRecord> sourceItems = sourceItems();
        DiscussionGuideRecord source = sourceGuide();

        var content = policy.editedContent(source, sourceItems, editRequest(sourceItems));

        assertThat(content.goal()).isEqualTo("편집 목표");
        assertThat(content.issues()).containsExactly("쟁점 1", "쟁점 2");
        assertThat(content.items()).hasSize(5);
        assertThat(content.items().stream().mapToInt(item -> item.expectedMinutes()).sum())
            .isEqualTo(40);
        assertThat(content.items().get(2)).satisfies(item -> {
            assertThat(item.stage()).isEqualTo("EXPERIENCE");
            assertThat(item.sourceType()).isEqualTo("ANSWER");
            assertThat(item.sourceRefId()).isEqualTo(103L);
            assertThat(item.sourceExcerpt()).isEqualTo("비공개 근거 3");
            assertThat(item.sensitivity()).isEqualTo("HIGH");
            assertThat(item.skippable()).isTrue();
        });
    }

    @Test
    void rejectsDuplicateQuestionOutOfOrderStageAndWrongMinuteTotal() {
        List<DiscussionGuideItemRecord> sourceItems = sourceItems();
        DiscussionGuideRecord source = sourceGuide();

        List<GuideItemEditRequest> duplicateQuestions = new ArrayList<>(
            editRequest(sourceItems).getItems()
        );
        duplicateQuestions.set(1, copyEdit(duplicateQuestions.get(1), "질문 1", 8));
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(duplicateQuestions)
        ));

        List<GuideItemEditRequest> outOfOrder = new ArrayList<>(editRequest(sourceItems).getItems());
        GuideItemEditRequest first = outOfOrder.get(0);
        outOfOrder.set(0, outOfOrder.get(1));
        outOfOrder.set(1, first);
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(outOfOrder)
        ));

        List<GuideItemEditRequest> wrongMinutes = new ArrayList<>(editRequest(sourceItems).getItems());
        wrongMinutes.set(0, copyEdit(wrongMinutes.get(0), "질문 1", 7));
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(wrongMinutes)
        ));
    }

    @Test
    void rejectsInvalidIdentityOwnershipBoundsAndFollowUps() {
        List<DiscussionGuideItemRecord> sourceItems = sourceItems();
        DiscussionGuideRecord source = sourceGuide();

        List<GuideItemEditRequest> duplicateIdentity = new ArrayList<>(
            editRequest(sourceItems).getItems()
        );
        duplicateIdentity.set(1, copyEdit(
            duplicateIdentity.get(1),
            duplicateIdentity.get(0).getItemId(),
            "질문 2",
            8,
            List.of("후속 2")
        ));
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(duplicateIdentity)
        ));

        List<GuideItemEditRequest> unownedIdentity = new ArrayList<>(
            editRequest(sourceItems).getItems()
        );
        unownedIdentity.set(0, copyEdit(
            unownedIdentity.get(0),
            999L,
            "질문 1",
            8,
            List.of("후속 1")
        ));
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(unownedIdentity)
        ));

        List<GuideItemEditRequest> invalidMinutes = new ArrayList<>(
            editRequest(sourceItems).getItems()
        );
        invalidMinutes.set(0, copyEdit(
            invalidMinutes.get(0),
            1L,
            "질문 1",
            21,
            List.of("후속 1")
        ));
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(invalidMinutes)
        ));

        List<GuideItemEditRequest> excessFollowUps = new ArrayList<>(
            editRequest(sourceItems).getItems()
        );
        excessFollowUps.set(0, copyEdit(
            excessFollowUps.get(0),
            1L,
            "질문 1",
            8,
            List.of("후속 1", "후속 2", "후속 3")
        ));
        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            requestWithItems(excessFollowUps)
        ));

        assertBadRequest(() -> policy.editedContent(
            source,
            sourceItems,
            EditDiscussionGuideRequest.builder()
                .expectedVersion(1)
                .goal(" ")
                .issues(List.of("쟁점 1"))
                .items(editRequest(sourceItems).getItems())
                .build()
        ));
    }

    private DiscussionGuideRecord sourceGuide() {
        return DiscussionGuideRecord.builder()
            .targetMinutes(40)
            .model("model")
            .tokenUsageJson("{\"totalTokens\":10}")
            .generationMetadataJson("{\"outcome\":\"SUCCESS\"}")
            .build();
    }

    private List<DiscussionGuideItemRecord> sourceItems() {
        List<DiscussionGuideItemRecord> items = new ArrayList<>();
        for (int index = 0; index < STAGES.size(); index++) {
            int ordinal = index + 1;
            items.add(DiscussionGuideItemRecord.builder()
                .id((long) ordinal)
                .stage(STAGES.get(index))
                .priority("REQUIRED")
                .sourceType(ordinal == 3 ? "ANSWER" : "REFLECTION")
                .sourceRefId(100L + ordinal)
                .sourceExcerpt(ordinal == 3 ? "비공개 근거 3" : "근거 " + ordinal)
                .sourceVersion("v" + ordinal)
                .sourceStale(ordinal == 4)
                .sourceFallback(ordinal == 5)
                .sensitivity(ordinal == 3 ? "HIGH" : "LOW")
                .skippable(ordinal == 3)
                .build());
        }
        return items;
    }

    private EditDiscussionGuideRequest editRequest(List<DiscussionGuideItemRecord> sourceItems) {
        return requestWithItems(sourceItems.stream()
            .map(item -> GuideItemEditRequest.builder()
                .itemId(item.getId())
                .question("질문 " + item.getId())
                .intent("의도 " + item.getId())
                .expectedMinutes(8)
                .followUps(List.of("후속 " + item.getId()))
                .build())
            .toList());
    }

    private EditDiscussionGuideRequest requestWithItems(List<GuideItemEditRequest> items) {
        return EditDiscussionGuideRequest.builder()
            .expectedVersion(1)
            .goal("편집 목표")
            .issues(List.of("쟁점 1", "쟁점 2"))
            .items(items)
            .build();
    }

    private GuideItemEditRequest copyEdit(
        GuideItemEditRequest source,
        String question,
        int expectedMinutes
    ) {
        return copyEdit(
            source,
            source.getItemId(),
            question,
            expectedMinutes,
            source.getFollowUps()
        );
    }

    private GuideItemEditRequest copyEdit(
        GuideItemEditRequest source,
        Long itemId,
        String question,
        int expectedMinutes,
        List<String> followUps
    ) {
        return GuideItemEditRequest.builder()
            .itemId(itemId)
            .question(question)
            .intent(source.getIntent())
            .expectedMinutes(expectedMinutes)
            .followUps(followUps)
            .build();
    }

    private void assertBadRequest(Runnable operation) {
        assertThatThrownBy(operation::run)
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_BAD_REQUEST)
            );
    }
}
