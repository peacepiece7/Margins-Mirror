package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiProvider;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.DiscussionGuideGeneration.Item;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.DiscussionGuideGeneration.Response;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.GuideBrief;
import com.margins.reflectionloop.ai.DiscussionGuideGenerator.SourceDraft;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

class DiscussionGuideGeneratorTest {

    @ParameterizedTest
    @ValueSource(ints = {20, 40, 60})
    void normalizesEverySupportedTargetToAnExactBoundedMinuteTotal(int targetMinutes) {
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any())).thenReturn(validResponse());

        var draft = generator(provider).generate(
            20L,
            "discussion-guide-v1",
            validSources(),
            new GuideBrief(
                "THOUGHT_EXPANSION",
                "SELF_AI",
                targetMinutes,
                "PRIVATE_CONTEXT"
            ),
            "SIMPLE",
            false
        );

        assertThat(draft.items())
            .allSatisfy(item -> assertThat(item.expectedMinutes()).isBetween(1, 20));
        assertThat(draft.items().stream()
            .mapToInt(DiscussionGuideGenerator.GuideItemDraft::expectedMinutes)
            .sum()).isEqualTo(targetMinutes);
    }

    @Test
    void validatesOneGroundedRequiredItemForEveryStageAndPreservesMetadata() {
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any())).thenReturn(validResponse());
        DiscussionGuideGenerator generator = new DiscussionGuideGenerator(
            provider,
            new ObjectMapper()
        );
        List<SourceDraft> sources = List.of(
            new SourceDraft("R1", "REFLECTION", 30L, "처음 생각"),
            new SourceDraft("A1", "ANSWER", 40L, "첫 답변")
        );

        var draft = generator.generate(
            20L,
            "discussion-guide-v1",
            sources,
            new GuideBrief("ISSUE_EXPLORATION", "SMALL_GROUP", 60, "PRIVATE_CONTEXT"),
            "STANDARD",
            true
        );

        assertThat(draft.goal()).contains("근거");
        assertThat(draft.issues()).hasSize(2);
        assertThat(draft.items()).hasSize(5);
        assertThat(draft.items()).extracting(DiscussionGuideGenerator.GuideItemDraft::stage)
            .containsExactly(
                "WARM_UP",
                "INTERPRETATION",
                "EXPERIENCE",
                "SOCIAL_VALUE",
                "CLOSING"
            );
        assertThat(draft.items()).allSatisfy(item -> {
            assertThat(item.question()).isNotBlank();
            assertThat(sources).contains(item.source());
            assertThat(item.priority()).isEqualTo("REQUIRED");
        });
        assertThat(draft.items().stream()
            .mapToInt(DiscussionGuideGenerator.GuideItemDraft::expectedMinutes)
            .sum()).isEqualTo(60);
        assertThat(draft.generationMetadataJson())
            .contains("\"provider\":\"openai\"")
            .contains("\"latencyMs\":42")
            .contains("\"fallbackUsed\":false");
        ArgumentCaptor<Request> request = ArgumentCaptor.forClass(Request.class);
        verify(provider).generateDiscussionGuide(request.capture());
        assertThat(request.getValue().purpose()).isEqualTo("ISSUE_EXPLORATION");
        assertThat(request.getValue().audienceMode()).isEqualTo("SMALL_GROUP");
        assertThat(request.getValue().targetMinutes()).isEqualTo(60);
        assertThat(request.getValue().disclosureMode()).isEqualTo("PRIVATE_CONTEXT");
        verify(provider, never()).suggestQuestions(any(), any());
    }

    @Test
    void rejectsUnsupportedBriefBeforeCallingTheProvider() {
        AiProvider provider = mock(AiProvider.class);

        assertThatThrownBy(() -> generator(provider).generate(
            20L,
            "discussion-guide-v1",
            validSources(),
            new GuideBrief("THOUGHT_EXPANSION", "SELF_AI", 30, "PRIVATE_CONTEXT"),
            "SIMPLE",
            false
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("brief");
        verify(provider, never()).generateDiscussionGuide(any());
    }

    @Test
    void rejectsInvalidSourceAliasBeforeAnyGuideCanBePersisted() {
        AiProvider provider = mock(AiProvider.class);
        Response invalid = new Response(
            "토론 목표",
            List.of("논점 하나", "논점 둘"),
            List.of(
                item("WARM_UP", "UNKNOWN"),
                item("INTERPRETATION", "R1"),
                item("EXPERIENCE", "R1"),
                item("SOCIAL_VALUE", "R1"),
                item("CLOSING", "R1")
            ),
            "openai",
            "gpt-test",
            null,
            10,
            "SUCCESS",
            false
        );
        when(provider.generateDiscussionGuide(any())).thenReturn(invalid);
        DiscussionGuideGenerator generator = new DiscussionGuideGenerator(
            provider,
            new ObjectMapper()
        );

        assertThatThrownBy(() -> generator.generate(
            20L,
            "discussion-guide-v1",
            List.of(new SourceDraft("R1", "REFLECTION", 30L, "처음 생각"))
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("source alias");
    }

    @Test
    void propagatesProviderFailureBeforeAnyGuideDraftCanBePersisted() {
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any()))
            .thenThrow(new IllegalStateException("provider unavailable"));
        DiscussionGuideGenerator generator = new DiscussionGuideGenerator(
            provider,
            new ObjectMapper()
        );

        assertThatThrownBy(() -> generator.generate(
            20L,
            "discussion-guide-v1",
            List.of(new SourceDraft("R1", "REFLECTION", 30L, "처음 생각"))
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void preservesProviderFailureCategoryInTheObservedFailClosedEvent() {
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuideWithMetadata(any())).thenReturn(
            AiGenerationResult.failure(
                new AiGenerationTask(
                    "DISCUSSION_GUIDE",
                    "discussion-guide-v1",
                    "discussion-guide-schema-v1"
                ),
                "openai",
                "gpt-test",
                new AiTokenUsage(10, 2, 3, 13),
                40,
                "TIMEOUT"
            )
        );
        DiscussionGuideGenerator generator = generator(provider);
        AtomicReference<AiGenerationResult<?>> observed = observe(generator);

        assertThatThrownBy(() -> generator.generate(
            20L,
            "discussion-guide-v1",
            validSources()
        )).isInstanceOf(IllegalStateException.class);

        assertThat(observed.get().failureCategory()).isEqualTo("TIMEOUT");
        assertThat(observed.get().inputTokens()).isEqualTo(10);
        assertThat(observed.get().outputTokens()).isEqualTo(3);
    }

    @Test
    void classifiesRequestAndResponseAliasFailuresAsEvidenceValidation() {
        AiProvider provider = mock(AiProvider.class);
        DiscussionGuideGenerator generator = generator(provider);
        AtomicReference<AiGenerationResult<?>> observed = observe(generator);

        assertThatThrownBy(() -> generator.generate(
            20L,
            "discussion-guide-v1",
            List.of(source("A1", "REFLECTION", 1L, "근거"))
        )).isInstanceOf(IllegalStateException.class);
        assertThat(observed.get().failureCategory()).isEqualTo("EVIDENCE_VALIDATION");

        Response invalid = response(
            "목표",
            List.of("논점 하나", "논점 둘"),
            List.of(
                item("WARM_UP", "UNKNOWN"),
                item("INTERPRETATION", "R1"),
                item("EXPERIENCE", "R1"),
                item("SOCIAL_VALUE", "R1"),
                item("CLOSING", "R1")
            )
        );
        when(provider.generateDiscussionGuide(any())).thenReturn(invalid);
        assertThatThrownBy(() -> generator.generate(
            20L,
            "discussion-guide-v1",
            List.of(source("R1", "REFLECTION", 1L, "근거"))
        )).isInstanceOf(IllegalStateException.class);
        assertThat(observed.get().failureCategory()).isEqualTo("EVIDENCE_VALIDATION");
    }

    @Test
    void classifiesHardInvariantFailuresAsSchemaValidation() {
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any())).thenReturn(
            response(" ", List.of("논점 하나", "논점 둘"), validResponse().items())
        );
        DiscussionGuideGenerator generator = generator(provider);
        AtomicReference<AiGenerationResult<?>> observed = observe(generator);

        assertThatThrownBy(() -> generator.generate(
            20L,
            "discussion-guide-v1",
            validSources()
        )).isInstanceOf(IllegalStateException.class);

        assertThat(observed.get().failureCategory()).isEqualTo("SCHEMA_VALIDATION");
    }

    @Test
    void rejectsEveryInvalidSourceCatalogShapeBeforeCallingTheProvider() {
        List<InvalidSources> cases = List.of(
            new InvalidSources("no evidence", List.of()),
            new InvalidSources(
                "duplicate alias",
                List.of(source("R1", "REFLECTION", 1L, "근거"), source("R1", "REFLECTION", 2L, "근거"))
            ),
            new InvalidSources(
                "alias/type mismatch",
                List.of(source("A1", "REFLECTION", 1L, "근거"))
            ),
            new InvalidSources(
                "unknown type",
                List.of(source("R1", "MEMORY", 1L, "근거"))
            ),
            new InvalidSources(
                "missing stable reference",
                List.of(source("R1", "REFLECTION", null, "근거"))
            ),
            new InvalidSources(
                "non-positive stable reference",
                List.of(source("R1", "REFLECTION", 0L, "근거"))
            ),
            new InvalidSources(
                "blank excerpt",
                List.of(source("R1", "REFLECTION", 1L, " "))
            ),
            new InvalidSources(
                "oversized excerpt",
                List.of(source("R1", "REFLECTION", 1L, "가".repeat(501)))
            )
        );

        for (InvalidSources invalidCase : cases) {
            AiProvider provider = mock(AiProvider.class);
            DiscussionGuideGenerator generator = generator(provider);

            assertThatThrownBy(() -> generator.generate(
                20L,
                "discussion-guide-v1",
                invalidCase.sources()
            ))
                .as(invalidCase.name())
                .isInstanceOf(IllegalStateException.class);
            verify(provider, never()).generateDiscussionGuide(any());
        }
    }

    @Test
    void rejectsANullProviderResult() {
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any())).thenReturn(null);

        assertThatThrownBy(() -> generator(provider).generate(
            20L,
            "discussion-guide-v1",
            validSources()
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("no result");
    }

    @Test
    void rejectsTheHardInvariantNegativeMatrix() {
        Item warmUp = item("WARM_UP", "R1");
        Item interpretation = item("INTERPRETATION", "A1");
        Item experience = item("EXPERIENCE", "R1");
        Item socialValue = item("SOCIAL_VALUE", "A1");
        Item closing = item("CLOSING", "R1");
        List<Item> validItems = List.of(
            warmUp,
            interpretation,
            experience,
            socialValue,
            closing
        );
        List<InvalidResponse> cases = List.of(
            new InvalidResponse("blank goal", response(" ", List.of("논점 하나", "논점 둘"), validItems)),
            new InvalidResponse("oversized goal", response("가".repeat(501), List.of("논점 하나", "논점 둘"), validItems)),
            new InvalidResponse("too few issues", response("목표", List.of("논점 하나"), validItems)),
            new InvalidResponse("too many issues", response("목표", List.of("1", "2", "3", "4", "5"), validItems)),
            new InvalidResponse("blank issue", response("목표", List.of(" ", "논점 둘"), validItems)),
            new InvalidResponse("oversized issue", response("목표", List.of("가".repeat(501), "논점 둘"), validItems)),
            new InvalidResponse("too few items", response("목표", List.of("1", "2"), validItems.subList(0, 4))),
            new InvalidResponse("invalid stage", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, "OPENING", null, null, null, null, null, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("invalid priority", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, "CORE", null, null, null, null, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("invalid sensitivity", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, "CRITICAL", null, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("unowned response alias", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, "A9", null, null, null, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("blank question", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, " ", null, null, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("oversized question", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, "가".repeat(1001), null, null, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("blank intent", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, null, null, " "),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("oversized intent", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, null, null, "가".repeat(1001)),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("normalized duplicate question", response("목표", List.of("1", "2"), List.of(
                warmUp,
                copy(interpretation, null, null, null, "  " + warmUp.question().toUpperCase() + "  ", null, null, null, null),
                experience, socialValue, closing
            ))),
            new InvalidResponse("too many follow-ups", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, null, List.of("1", "2", "3"), null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("blank follow-up", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, null, List.of(" "), null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("oversized follow-up", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, null, List.of("가".repeat(1001)), null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("invalid expected minutes", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, 0, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("expected minutes over maximum", response("목표", List.of("1", "2"), List.of(
                copy(warmUp, null, null, null, null, null, 21, null, null),
                interpretation, experience, socialValue, closing
            ))),
            new InvalidResponse("missing required stage", response("목표", List.of("1", "2"), List.of(
                warmUp, interpretation, experience, socialValue,
                copy(closing, null, "OPTIONAL", null, null, null, null, null, null)
            ))),
            new InvalidResponse("required stages out of order", response("목표", List.of("1", "2"), List.of(
                interpretation, warmUp, experience, socialValue, closing
            ))),
            new InvalidResponse("more than three optional items", response("목표", List.of("1", "2"), List.of(
                warmUp, interpretation, experience, socialValue, closing,
                optional("WARM_UP", "R1", "선택 질문 1"),
                optional("INTERPRETATION", "A1", "선택 질문 2"),
                optional("SOCIAL_VALUE", "R1", "선택 질문 3"),
                optional("CLOSING", "A1", "선택 질문 4")
            )))
        );

        for (InvalidResponse invalidCase : cases) {
            AiProvider provider = mock(AiProvider.class);
            when(provider.generateDiscussionGuide(any())).thenReturn(invalidCase.response());

            assertThatThrownBy(() -> generator(provider).generate(
                20L,
                "discussion-guide-v1",
                validSources()
            ))
                .as(invalidCase.name())
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    void normalizesExperienceAsSkippableWithoutAnotherProviderCall() {
        Response response = validResponse();
        List<Item> items = new ArrayList<>(response.items());
        Item experience = items.get(2);
        items.set(
            2,
            copy(
                experience,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false
            )
        );
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any())).thenReturn(response(
            response.goal(),
            response.issues(),
            items
        ));

        var draft = generator(provider).generate(
            20L,
            "discussion-guide-v1",
            validSources()
        );

        assertThat(draft.items())
            .filteredOn(item -> "EXPERIENCE".equals(item.stage()))
            .singleElement()
            .extracting(DiscussionGuideGenerator.GuideItemDraft::skippable)
            .isEqualTo(true);
        verify(provider).generateDiscussionGuide(any());
    }

    @Test
    void acceptsThreeOptionalItemsWithoutChangingTheRequiredStageOrder() {
        Response response = validResponse();
        List<Item> items = new ArrayList<>(response.items());
        items.add(optional("WARM_UP", "R1", "선택 질문 1"));
        items.add(optional("INTERPRETATION", "A1", "선택 질문 2"));
        items.add(optional("CLOSING", "R1", "선택 질문 3"));
        AiProvider provider = mock(AiProvider.class);
        when(provider.generateDiscussionGuide(any())).thenReturn(response(
            response.goal(),
            response.issues(),
            items
        ));

        var draft = generator(provider).generate(
            20L,
            "discussion-guide-v1",
            validSources()
        );

        assertThat(draft.items()).hasSize(8);
        assertThat(draft.items()).filteredOn(item -> "OPTIONAL".equals(item.priority()))
            .hasSize(3);
    }

    private Response validResponse() {
        return response(
            "처음 생각의 근거와 대안을 살펴봅니다.",
            List.of("본문 근거", "다른 가능성"),
            List.of(
                item("WARM_UP", "R1"),
                item("INTERPRETATION", "A1"),
                item("EXPERIENCE", "R1"),
                item("SOCIAL_VALUE", "A1"),
                item("CLOSING", "R1")
            )
        );
    }

    private Response response(String goal, List<String> issues, List<Item> items) {
        return new Response(
            goal,
            issues,
            items,
            "openai",
            "gpt-test",
            "{\"totalTokens\":10}",
            42,
            "SUCCESS",
            false
        );
    }

    private Item item(String stage, String sourceAlias) {
        return new Item(
            stage,
            "REQUIRED",
            stage + "에서 서로 다른 질문을 살펴보면 무엇이 보이나요?",
            stage + " 질문의 의도를 확인합니다.",
            sourceAlias,
            "EXPERIENCE".equals(stage) ? "MEDIUM" : "LOW",
            true,
            5,
            List.of("한 문장으로 더 구체화하면 어떻게 말할 수 있나요?")
        );
    }

    private Item optional(String stage, String sourceAlias, String question) {
        return new Item(
            stage,
            "OPTIONAL",
            question,
            "선택 질문의 의도를 확인합니다.",
            sourceAlias,
            "LOW",
            true,
            3,
            List.of()
        );
    }

    private Item copy(
        Item item,
        String stage,
        String priority,
        String sourceAlias,
        String question,
        String sensitivity,
        Integer expectedMinutes,
        List<String> followUps,
        String intent
    ) {
        return copy(
            item,
            stage,
            priority,
            sourceAlias,
            question,
            sensitivity,
            expectedMinutes,
            followUps,
            intent,
            item.skippable()
        );
    }

    private Item copy(
        Item item,
        String stage,
        String priority,
        String sourceAlias,
        String question,
        String sensitivity,
        Integer expectedMinutes,
        List<String> followUps,
        String intent,
        boolean skippable
    ) {
        return new Item(
            stage == null ? item.stage() : stage,
            priority == null ? item.priority() : priority,
            question == null ? item.question() : question,
            intent == null ? item.intent() : intent,
            sourceAlias == null ? item.sourceAlias() : sourceAlias,
            sensitivity == null ? item.sensitivity() : sensitivity,
            skippable,
            expectedMinutes == null ? item.expectedMinutes() : expectedMinutes,
            followUps == null ? item.followUps() : followUps
        );
    }

    private DiscussionGuideGenerator generator(AiProvider provider) {
        return new DiscussionGuideGenerator(provider, new ObjectMapper());
    }

    private AtomicReference<AiGenerationResult<?>> observe(
        DiscussionGuideGenerator generator
    ) {
        AtomicReference<AiGenerationResult<?>> observed = new AtomicReference<>();
        ReflectionTestUtils.setField(
            generator,
            "generationObserver",
            (com.margins.ai.AiGenerationObserver) (result, depth, testData) ->
                observed.set(result)
        );
        return observed;
    }

    private List<SourceDraft> validSources() {
        return List.of(
            source("R1", "REFLECTION", 30L, "처음 생각"),
            source("A1", "ANSWER", 40L, "첫 답변")
        );
    }

    private SourceDraft source(String alias, String type, Long refId, String excerpt) {
        return new SourceDraft(alias, type, refId, excerpt);
    }

    private record InvalidSources(String name, List<SourceDraft> sources) {
    }

    private record InvalidResponse(String name, Response response) {
    }
}
