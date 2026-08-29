package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.persona.model.PersonaRecord;
import com.margins.reflectionloop.ai.DiscussionDirector;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.SendMessageRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class DiscussionDirectorTest {
    private final AiProvider aiProvider = mock(AiProvider.class);
    private final DiscussionDirector director = new DiscussionDirector(aiProvider, new ObjectMapper());
    private final DiscussionGuideItemRecord first = item(1L, 1);
    private final DiscussionGuideItemRecord second = item(2L, 2);

    @Test
    void malformedProviderOutputFallsBackToFollowUpWithoutAdvancing() {
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any())).thenAnswer(invocation -> AiGenerationResult.completed(
            AiMessageResponse.builder().content("structured output unavailable").build()
            , invocation.getArgument(2), "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false));

        var decision = director.decide(
            10L, first, List.of(first, second), "짧은 답", "RESPOND", GenerationLocale.KO
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.targetItem()).isSameAs(first);
    }

    @Test
    void missingPerspectiveCandidatesFailClosedWithoutSelectingAView() {
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any())).thenAnswer(invocation -> AiGenerationResult.completed(
            AiMessageResponse.builder()
                .content("{\"action\":\"CALL_PERSPECTIVE\"}")
                .build()
            , invocation.getArgument(2), "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false));

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "이 장면의 선택은 책임을 피하는 행동처럼 보이지만 동시에 다른 인물을 보호하려는 망설임도 드러냅니다.",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(PersonaRecord.builder().id(20L).displayName("첫 관점").build()),
            GenerationLocale.KO
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.targetItem()).isSameAs(first);
        assertThat(decision.candidatePersonaIds()).isEmpty();
    }

    @Test
    void trailingTokensFailClosedInsteadOfAcceptingPartialJson() {
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any())).thenAnswer(invocation -> AiGenerationResult.completed(
            AiMessageResponse.builder()
                .content("{\"action\":\"ASK_FOLLOW_UP\",\"reply\":\"답\",\"focus\":\"쟁점\",\"candidatePersonaIds\":[]} trailing")
                .build()
            , invocation.getArgument(2), "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false));

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "답변",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(),
            GenerationLocale.KO
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.candidatePersonaIds()).isEmpty();
    }

    @Test
    void overlongReplyFailsClosedWithoutSelectingAPerspective() {
        String overlongReply = "a".repeat(401);
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any())).thenAnswer(invocation -> AiGenerationResult.completed(
            AiMessageResponse.builder()
                .content("{\"action\":\"CALL_PERSPECTIVE\",\"reply\":\""
                    + overlongReply
                    + "\",\"focus\":\"쟁점\",\"candidatePersonaIds\":[20]}")
                .build()
            , invocation.getArgument(2), "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false));

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "답변",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(PersonaRecord.builder().id(20L).displayName("첫 관점").build()),
            GenerationLocale.KO
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.candidatePersonaIds()).isEmpty();
    }

    @Test
    void manualNavigationOverridesAutomaticDecision() {
        var next = director.decide(
            10L, first, List.of(first, second), "어떤 답변", "NEXT", GenerationLocale.KO
        );
        var finish = director.decide(
            10L, first, List.of(first, second), "어떤 답변", "FINISH", GenerationLocale.KO
        );

        assertThat(next.action()).isEqualTo("MOVE_NEXT_TOPIC");
        assertThat(next.targetItem()).isSameAs(second);
        assertThat(finish.action()).isEqualTo("FINISH_DISCUSSION");
        verifyNoInteractions(aiProvider);
    }

    @Test
    void providerFailureKeepsCurrentItemAndManualProgressionAvailable() {
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any()))
            .thenThrow(new IllegalStateException("provider unavailable"));

        var decision = director.decide(
            10L, first, List.of(first, second), "답변", "RESPOND", GenerationLocale.KO
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.targetItem()).isSameAs(first);
    }

    @Test
    void malformedEnglishGenerationUsesEnglishRuleFallback() {
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any())).thenAnswer(invocation -> AiGenerationResult.completed(
            AiMessageResponse.builder().content("not-json").build()
            , invocation.getArgument(2), "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false));

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "Reader answer",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(),
            GenerationLocale.EN
        );

        assertThat(decision.reply()).isEqualTo(
            "Could you make that point one sentence more specific?"
        );
        assertThat(decision.focus()).isEqualTo("Current focus");
    }

    @Test
    void englishDirectorRequestUsesEnglishControlInstructionsOnly() {
        ArgumentCaptor<SendMessageRequest> request = ArgumentCaptor.forClass(
            SendMessageRequest.class
        );
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), request.capture(), any()))
            .thenAnswer(invocation -> AiGenerationResult.completed(
                AiMessageResponse.builder()
                    .content("{\"action\":\"ASK_FOLLOW_UP\",\"reply\":\"Could you clarify the evidence?\",\"focus\":\"Evidence and responsibility\",\"candidatePersonaIds\":[]}")
                    .build(),
                invocation.getArgument(2),
                "openai",
                "model",
                AiTokenUsage.NONE,
                0,
                "SUCCESS",
                false
            ));
        DiscussionGuideItemRecord englishItem = DiscussionGuideItemRecord.builder()
            .id(3L)
            .questionId(103L)
            .itemOrder(1)
            .questionText("What evidence supports that interpretation?")
            .intent("Connect the interpretation to the text")
            .sourceExcerpt("The character pauses before answering.")
            .build();

        director.decide(
            10L,
            englishItem,
            List.of(englishItem),
            "The pause suggests hesitation.",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(),
            GenerationLocale.EN
        );

        assertThat(request.getValue().getContent())
            .contains(
                "Current guide question:",
                "Choose exactly one next action.",
                "Return exactly one JSON object:"
            )
            .doesNotContain(
                "현재 발제 질문:",
                "다음 진행 하나만 결정하세요.",
                "JSON 하나만 반환하세요."
            );
    }

    @Test
    void directorBoundsAndValidatesPerspectiveCandidatesAgainstActiveCatalog() {
        when(aiProvider.answerWindowMessageWithMetadata(eq(10L), any(), any())).thenAnswer(invocation -> AiGenerationResult.completed(
            AiMessageResponse.builder()
                .content("{\"action\":\"CALL_PERSPECTIVE\",\"candidatePersonaIds\":[22,21,999,20],\"reply\":\"답을 반영했습니다.\",\"focus\":\"책임과 보호의 긴장\"}")
                .build()
            , invocation.getArgument(2), "openai", "model", AiTokenUsage.NONE, 0, "SUCCESS", false));

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "답변",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(
                PersonaRecord.builder().id(20L).displayName("첫 관점").build(),
                PersonaRecord.builder().id(21L).displayName("둘째 관점").build(),
                PersonaRecord.builder().id(22L).displayName("셋째 관점").build()
            ),
            GenerationLocale.KO
        );

        assertThat(decision.candidatePersonaIds()).containsExactly(22L, 21L);
        assertThat(decision.reply()).isEqualTo("답을 반영했습니다.");
        assertThat(decision.focus()).isEqualTo("책임과 보호의 긴장");
    }

    private DiscussionGuideItemRecord item(Long id, int order) {
        return DiscussionGuideItemRecord.builder()
            .id(id)
            .questionId(100L + id)
            .itemOrder(order)
            .questionText("질문 " + order)
            .intent("질문 의도")
            .sourceExcerpt("제한된 근거")
            .build();
    }
}
