package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiProvider;
import com.margins.persona.model.PersonaRecord;
import com.margins.reflectionloop.ai.DiscussionDirector;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.session.dto.AiMessageResponse;
import java.util.List;
import org.junit.jupiter.api.Test;

class DiscussionDirectorTest {
    private final AiProvider aiProvider = mock(AiProvider.class);
    private final DiscussionDirector director = new DiscussionDirector(aiProvider, new ObjectMapper());
    private final DiscussionGuideItemRecord first = item(1L, 1);
    private final DiscussionGuideItemRecord second = item(2L, 2);

    @Test
    void malformedProviderOutputFallsBackToFollowUpWithoutAdvancing() {
        when(aiProvider.answerWindowMessage(eq(10L), any())).thenReturn(
            AiMessageResponse.builder().content("structured output unavailable").build()
        );

        var decision = director.decide(10L, first, List.of(first, second), "짧은 답", "RESPOND");

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.targetItem()).isSameAs(first);
    }

    @Test
    void missingPerspectiveCandidatesFailClosedWithoutSelectingAView() {
        when(aiProvider.answerWindowMessage(eq(10L), any())).thenReturn(
            AiMessageResponse.builder()
                .content("{\"action\":\"CALL_PERSPECTIVE\"}")
                .build()
        );

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "이 장면의 선택은 책임을 피하는 행동처럼 보이지만 동시에 다른 인물을 보호하려는 망설임도 드러냅니다.",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(PersonaRecord.builder().id(20L).displayName("첫 관점").build())
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.targetItem()).isSameAs(first);
        assertThat(decision.candidatePersonaIds()).isEmpty();
    }

    @Test
    void trailingTokensFailClosedInsteadOfAcceptingPartialJson() {
        when(aiProvider.answerWindowMessage(eq(10L), any())).thenReturn(
            AiMessageResponse.builder()
                .content("{\"action\":\"ASK_FOLLOW_UP\",\"reply\":\"답\",\"focus\":\"쟁점\",\"candidatePersonaIds\":[]} trailing")
                .build()
        );

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "답변",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of()
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.candidatePersonaIds()).isEmpty();
    }

    @Test
    void overlongReplyFailsClosedWithoutSelectingAPerspective() {
        String overlongReply = "a".repeat(401);
        when(aiProvider.answerWindowMessage(eq(10L), any())).thenReturn(
            AiMessageResponse.builder()
                .content("{\"action\":\"CALL_PERSPECTIVE\",\"reply\":\""
                    + overlongReply
                    + "\",\"focus\":\"쟁점\",\"candidatePersonaIds\":[20]}")
                .build()
        );

        var decision = director.decide(
            10L,
            first,
            List.of(first, second),
            "답변",
            "RESPOND",
            "discussion-director-v1",
            "SIMPLE",
            true,
            List.of(PersonaRecord.builder().id(20L).displayName("첫 관점").build())
        );

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.candidatePersonaIds()).isEmpty();
    }

    @Test
    void manualNavigationOverridesAutomaticDecision() {
        var next = director.decide(10L, first, List.of(first, second), "어떤 답변", "NEXT");
        var finish = director.decide(10L, first, List.of(first, second), "어떤 답변", "FINISH");

        assertThat(next.action()).isEqualTo("MOVE_NEXT_TOPIC");
        assertThat(next.targetItem()).isSameAs(second);
        assertThat(finish.action()).isEqualTo("FINISH_DISCUSSION");
        verifyNoInteractions(aiProvider);
    }

    @Test
    void providerFailureKeepsCurrentItemAndManualProgressionAvailable() {
        when(aiProvider.answerWindowMessage(eq(10L), any()))
            .thenThrow(new IllegalStateException("provider unavailable"));

        var decision = director.decide(10L, first, List.of(first, second), "답변", "RESPOND");

        assertThat(decision.action()).isEqualTo("ASK_FOLLOW_UP");
        assertThat(decision.targetItem()).isSameAs(first);
    }

    @Test
    void directorBoundsAndValidatesPerspectiveCandidatesAgainstActiveCatalog() {
        when(aiProvider.answerWindowMessage(eq(10L), any())).thenReturn(
            AiMessageResponse.builder()
                .content("{\"action\":\"CALL_PERSPECTIVE\",\"candidatePersonaIds\":[22,21,999,20],\"reply\":\"답을 반영했습니다.\",\"focus\":\"책임과 보호의 긴장\"}")
                .build()
        );

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
            )
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
