package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.moderation.DiscussionModerator;
import com.margins.moderation.DiscussionModerationResult;
import com.margins.moderation.ModerationDecision;
import com.margins.moderation.ModerationFeedback;
import com.margins.moderation.ModerationIntent;
import com.margins.moderation.ModerationProperties;
import com.margins.moderation.business.ModerationBusiness;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.dto.ModerationFeedbackRequest;
import com.margins.moderation.mapper.ModerationEventMapper;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.session.model.SessionWindowContext;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ModerationBusinessTest {
    private ModerationEventMapper mapper;
    private DiscussionModerator moderator;
    private ModerationBusiness business;
    private ModerationEventRecord event;

    @BeforeEach
    void setUp() {
        TestSecurityContextSupport.loginAs(1L, "reader");
        mapper = mock(ModerationEventMapper.class);
        moderator = mock(DiscussionModerator.class);
        business = new ModerationBusiness(
            new ModerationProperties(),
            moderator,
            mapper
        );
        GenerationLocaleResolver resolver = mock(GenerationLocaleResolver.class);
        when(resolver.resolve(any())).thenReturn(GenerationLocale.KO);
        business.configureGenerationLocale(resolver, new AiOutputLanguageValidator());
        event = ModerationEventRecord.builder()
            .id(50L)
            .userId(1L)
            .sessionId(20L)
            .windowId(10L)
            .decision("REJECT")
            .intent("MEANINGLESS")
            .reasonCode("MEANINGLESS")
            .model("gpt-5.6-luna")
            .promptVersion("prompt-v1")
            .routingOutcome("REJECTED")
            .createdAt(Instant.parse("2026-07-29T00:00:00Z"))
            .build();
    }

    @AfterEach
    void tearDown() {
        TestSecurityContextSupport.clear();
    }

    @Test
    void savesFirstOwnerFeedbackAndReturnsCompactEvent() {
        ModerationEventRecord saved = event.toBuilder().userFeedback("RELATED").build();
        when(mapper.findByIdAndUserId(50L, 1L)).thenReturn(event, saved);
        when(mapper.setFirstFeedback(50L, 1L, "RELATED")).thenReturn(1);
        when(mapper.incrementFeedbackAggregate(event, "RELATED")).thenReturn(1);

        ModerationEventDto response = business.feedback(
            50L,
            ModerationFeedbackRequest.builder().feedback(ModerationFeedback.RELATED).build()
        );

        assertThat(response.getUserFeedback()).isEqualTo("RELATED");
        assertThat(response.getDecision()).isEqualTo("REJECT");
    }

    @Test
    void rejectsSecondFeedbackWithoutChangingAggregate() {
        when(mapper.findByIdAndUserId(50L, 1L)).thenReturn(event);
        when(mapper.setFirstFeedback(50L, 1L, "NOT_RELATED")).thenReturn(0);

        assertThatThrownBy(() -> business.feedback(
            50L,
            ModerationFeedbackRequest.builder().feedback(ModerationFeedback.NOT_RELATED).build()
        ))
            .isInstanceOf(ApiException.class)
            .extracting(exception -> ((ApiException) exception).getCode())
            .isEqualTo(ApiErrorCode.COMMON_CONFLICT);
    }

    @Test
    void hidesAnotherReadersEventAsNotFound() {
        when(mapper.findByIdAndUserId(50L, 1L)).thenReturn(null);

        assertThatThrownBy(() -> business.feedback(
            50L,
            ModerationFeedbackRequest.builder().feedback(ModerationFeedback.RELATED).build()
        ))
            .isInstanceOf(ApiException.class)
            .extracting(exception -> ((ApiException) exception).getCode())
            .isEqualTo(ApiErrorCode.COMMON_NOT_FOUND);
    }

    @Test
    void replacesOnlyMismatchedRedirectQuestionAndKeepsModerationDecision() {
        DiscussionModerationResult providerResult = DiscussionModerationResult.builder()
            .decision(ModerationDecision.REDIRECT)
            .intent(ModerationIntent.BENIGN_OFF_TOPIC)
            .relevanceScore(0.1)
            .confidence(0.9)
            .reasonCode("OFF_TOPIC")
            .suggestedQuestion("Which scene from the book stayed with you most strongly and why?")
            .model("test-model")
            .build();
        when(moderator.moderateWithMetadata(any(), any())).thenCallRealMethod();
        when(moderator.moderate(any())).thenReturn(providerResult);
        when(mapper.insert(any())).thenAnswer(invocation -> {
            ModerationEventRecord inserted = invocation.getArgument(0);
            inserted.setId(51L);
            return 1;
        });
        when(mapper.incrementEventAggregate(any())).thenReturn(1);
        when(mapper.findByIdAndUserId(51L, 1L)).thenAnswer(invocation -> eventFromInsert());

        SessionWindowContext context = new SessionWindowContext(10L, 20L, 1L);
        ModerationEventRecord saved = business.evaluate(context, "오늘 저녁 메뉴 추천해줘");

        assertThat(saved.getDecision()).isEqualTo("REDIRECT");
        assertThat(saved.getIntent()).isEqualTo("BENIGN_OFF_TOPIC");
        assertThat(saved.getSuggestedQuestion()).contains("책의 주제로 돌아가");
        assertThat(saved.getGenerationLocale()).isEqualTo("ko");
        assertThat(saved.getLanguageValidationOutcome()).isEqualTo("KNOWN_MISMATCH");
        assertThat(saved.isFallbackUsed()).isTrue();
    }

    private ModerationEventRecord eventFromInsert() {
        org.mockito.ArgumentCaptor<ModerationEventRecord> captor =
            org.mockito.ArgumentCaptor.forClass(ModerationEventRecord.class);
        org.mockito.Mockito.verify(mapper).insert(captor.capture());
        return captor.getValue();
    }
}
