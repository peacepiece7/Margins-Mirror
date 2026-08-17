package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.moderation.DiscussionModerator;
import com.margins.moderation.ModerationFeedback;
import com.margins.moderation.ModerationProperties;
import com.margins.moderation.business.ModerationBusiness;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.dto.ModerationFeedbackRequest;
import com.margins.moderation.mapper.ModerationEventMapper;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ModerationBusinessTest {
    private ModerationEventMapper mapper;
    private ModerationBusiness business;
    private ModerationEventRecord event;

    @BeforeEach
    void setUp() {
        TestSecurityContextSupport.loginAs(1L, "reader");
        mapper = mock(ModerationEventMapper.class);
        business = new ModerationBusiness(
            new ModerationProperties(),
            mock(DiscussionModerator.class),
            mapper
        );
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
}
