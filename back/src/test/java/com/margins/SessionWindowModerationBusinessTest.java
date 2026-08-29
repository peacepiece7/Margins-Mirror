package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.business.ModerationBusiness;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.question.mapper.QuestionMapper;
import com.margins.session.business.SessionWindowBusiness;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.SessionWindowContext;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class SessionWindowModerationBusinessTest {

    @AfterEach
    void clearSecurityContext() {
        com.margins.testsupport.TestSecurityContextSupport.clear();
    }

    @Test
    void rejectKeepsACompactEventWithoutMessageOrPersonaCall() {
        Fixture fixture = new Fixture("REJECT", "MEANINGLESS");

        DebateTurnResponse response = fixture.business.debate(10L, DebateMessageRequest.builder()
            .personaId(4L)
            .content("...")
            .build());

        assertThat(response.getMessages()).isEmpty();
        assertThat(response.getModeration().getDecision()).isEqualTo("REJECT");
        verify(fixture.messageMapper, never()).insert(any());
        verify(fixture.aiProvider, never()).answerDebateMessageWithMetadata(any(), any(), any());
    }

    @Test
    void redirectReturnsSuggestionWithoutMessageOrPersonaCall() {
        Fixture fixture = new Fixture("REDIRECT", "BENIGN_OFF_TOPIC");

        DebateTurnResponse response = fixture.business.debate(10L, DebateMessageRequest.builder()
            .personaId(4L)
            .content("저녁 메뉴 추천해줘")
            .build());

        assertThat(response.getMessages()).isEmpty();
        assertThat(response.getModeration().getSuggestedQuestion()).contains("선택");
        verify(fixture.messageMapper, never()).insert(any());
        verify(fixture.aiProvider, never()).answerDebateMessageWithMetadata(any(), any(), any());
    }

    @Test
    void allowPersistsReaderAndPersonaMessagesAndFinalizesEvent() {
        Fixture fixture = new Fixture("ALLOW", "BOOK_DISCUSSION");
        AtomicLong ids = new AtomicLong(100);
        when(fixture.messageMapper.selectNextOrder(20L, 10L)).thenReturn(1, 2);
        doAnswer(invocation -> {
            MessageRecord record = invocation.getArgument(0);
            record.setId(ids.getAndIncrement());
            return 1;
        }).when(fixture.messageMapper).insert(any());
        when(fixture.aiProvider.answerDebateMessageWithMetadata(eq(10L), any(), any()))
            .thenAnswer(invocation -> AiGenerationResult.completed(
                AiMessageResponse.builder()
                    .windowId(10L)
                    .personaId(4L)
                    .role("assistant")
                    .content("근거를 더 살펴보죠.")
                    .streamingReady(true)
                    .aiModel("test-model")
                    .build(),
                invocation.getArgument(2),
                "openai",
                "test-model",
                AiTokenUsage.NONE,
                0,
                "SUCCESS",
                false
            ));
        ModerationEventRecord finalized = fixture.event.toBuilder()
            .messageId(100L)
            .routingOutcome("PERSONA_CALLED")
            .personaCalled(true)
            .build();
        when(fixture.moderationBusiness.finalizeAllowed(fixture.event, 100L, true))
            .thenReturn(finalized);
        when(fixture.moderationBusiness.toDto(finalized)).thenReturn(fixture.dto(finalized));

        DebateTurnResponse response = fixture.business.debate(10L, DebateMessageRequest.builder()
            .personaId(4L)
            .content("이 선택은 권력을 피하려는 행동일까요?")
            .build());

        assertThat(response.getMessages()).singleElement()
            .satisfies(message -> assertThat(message.getPersonaId()).isEqualTo(4L));
        assertThat(response.getModeration().isPersonaCalled()).isTrue();
        verify(fixture.messageMapper, org.mockito.Mockito.times(2)).insert(any());
        verify(fixture.aiProvider).answerDebateMessageWithMetadata(eq(10L), any(), any());
    }

    private static final class Fixture {
        private final AiProvider aiProvider = mock(AiProvider.class);
        private final SessionWindowMapper windowMapper = mock(SessionWindowMapper.class);
        private final MessageMapper messageMapper = mock(MessageMapper.class);
        private final QuestionMapper questionMapper = mock(QuestionMapper.class);
        private final PersonaMapper personaMapper = mock(PersonaMapper.class);
        private final ModerationBusiness moderationBusiness = mock(ModerationBusiness.class);
        private final ModerationEventRecord event;
        private final SessionWindowBusiness business;

        private Fixture(String decision, String intent) {
            com.margins.testsupport.TestSecurityContextSupport.loginAs(30L, "reader");
            SessionWindowContext context = new SessionWindowContext(
                10L,
                20L,
                30L,
                40L,
                "Dune",
                "Frank Herbert",
                null,
                null
            );
            when(windowMapper.findContextById(10L)).thenReturn(context);
            when(personaMapper.findActiveByIdForUser(eq(4L), eq(30L))).thenReturn(PersonaRecord.builder()
                .id(4L)
                .name("writer")
                .displayName("작가")
                .systemPrompt("Discuss")
                .active(true)
                .build());
            event = ModerationEventRecord.builder()
                .id(50L)
                .requestId("request")
                .userId(30L)
                .bookId(40L)
                .sessionId(20L)
                .windowId(10L)
                .decision(decision)
                .intent(intent)
                .reasonCode("POLICY")
                .suggestedQuestion("이 선택은 책의 주제와 어떻게 연결될까요?")
                .model("gpt-5.6-luna")
                .routingOutcome("ALLOW".equals(decision) ? "PENDING" : decision + "ED")
                .createdAt(Instant.parse("2026-07-29T00:00:00Z"))
                .build();
            when(moderationBusiness.isEnabled()).thenReturn(true);
            when(moderationBusiness.evaluate(
                eq(context), any(), org.mockito.ArgumentMatchers.isNull(), eq(GenerationLocale.KO)
            )).thenReturn(event);
            when(moderationBusiness.toDto(event)).thenReturn(dto(event));
            business = new SessionWindowBusiness(
                aiProvider,
                windowMapper,
                messageMapper,
                questionMapper,
                personaMapper
            );
            GenerationLocaleResolver resolver = mock(GenerationLocaleResolver.class);
            when(resolver.resolve(any())).thenReturn(GenerationLocale.KO);
            business.configureGenerationLocale(resolver, new AiOutputLanguageValidator());
            ReflectionTestUtils.setField(business, "moderationBusiness", moderationBusiness);
        }

        private ModerationEventDto dto(ModerationEventRecord record) {
            return ModerationEventDto.builder()
                .eventId(record.getId())
                .sessionId(record.getSessionId())
                .windowId(record.getWindowId())
                .decision(record.getDecision())
                .intent(record.getIntent())
                .reasonCode(record.getReasonCode())
                .suggestedQuestion(record.getSuggestedQuestion())
                .routingOutcome(record.getRoutingOutcome())
                .personaCalled(record.isPersonaCalled())
                .createdAt(record.getCreatedAt())
                .build();
        }
    }
}
