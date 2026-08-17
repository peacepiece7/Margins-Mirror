package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.business.DiscussionGuideBusiness;
import com.margins.reflectionloop.business.DiscussionGuideProjectionBusiness;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionQuestionDto;
import com.margins.reflectionloop.model.dto.response.FacilitatorDiscussionGuideProjectionResponse;
import com.margins.reflectionloop.model.dto.response.ParticipantDiscussionGuideProjectionResponse;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.model.ReadingSessionRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DiscussionGuideProjectionBusinessTest {
    private final DiscussionGuideBusiness guideBusiness = mock(DiscussionGuideBusiness.class);
    private final ReadingSessionMapper readingSessionMapper = mock(ReadingSessionMapper.class);
    private final DiscussionGuideProjectionBusiness projectionBusiness =
        new DiscussionGuideProjectionBusiness(guideBusiness, readingSessionMapper);

    @BeforeEach
    void login() {
        TestSecurityContextSupport.loginAs(1L, "reader");
        when(guideBusiness.get(7L)).thenReturn(archivedGuide());
        when(readingSessionMapper.findByIdAndUserId(4L, 1L)).thenReturn(
            ReadingSessionRecord.builder()
                .id(4L)
                .bookTitle("Markdown # Book")
                .bookAuthor("Reader Author")
                .build()
        );
    }

    @AfterEach
    void logout() {
        TestSecurityContextSupport.clear();
    }

    @Test
    void projectsDistinctFacilitatorAndParticipantPrivacyShapes() throws Exception {
        var facilitator = (FacilitatorDiscussionGuideProjectionResponse)
            projectionBusiness.projection(7L, "FACILITATOR");
        var participant = (ParticipantDiscussionGuideProjectionResponse)
            projectionBusiness.projection(7L, "PARTICIPANT");

        assertThat(facilitator.getGuideVersion()).isEqualTo(1);
        assertThat(facilitator.isCurrent()).isFalse();
        assertThat(facilitator.getItems().get(0).getSourceLabel())
            .isEqualTo("비공개 인터뷰 답변");
        assertThat(facilitator.getItems().get(0).getSourceExcerpt()).isNull();
        assertThat(facilitator.getItems().get(1).getSourceExcerpt())
            .isEqualTo("현재 Reflection 근거");

        assertThat(participant.getItems())
            .extracting(item -> item.getQuestion())
            .containsExactly("# 첫 질문", "둘째 질문");
        String participantJson = new ObjectMapper().writeValueAsString(participant);
        assertThat(participantJson)
            .doesNotContain(
                "민감 답변 원문",
                "현재 Reflection 근거",
                "\"intent\"",
                "\"sourceType\"",
                "\"sourceLabel\"",
                "\"sourceExcerpt\"",
                "\"privateSource\"",
                "\"sensitivity\"",
                "\"skippable\"",
                "\"expectedMinutes\"",
                "\"targetMinutes\"",
                "\"followUps\""
            );
    }

    @Test
    void rendersVersionPinnedEscapedMarkdownWithoutPrivateAnswerContent() {
        var facilitator = projectionBusiness.markdown(7L, "FACILITATOR");
        var participant = projectionBusiness.markdown(7L, "PARTICIPANT");

        assertThat(facilitator.getFilename())
            .isEqualTo("markdown-book-v1-facilitator.md");
        assertThat(facilitator.getContent())
            .contains("진행자용", "진행 의도", "비공개 인터뷰 답변", "\\# 첫 질문")
            .doesNotContain("민감 답변 원문");
        assertThat(participant.getFilename())
            .isEqualTo("markdown-book-v1-participant.md");
        assertThat(participant.getContent())
            .contains("참여자용", "\\# 첫 질문")
            .doesNotContain(
                "민감 답변 원문",
                "현재 Reflection 근거",
                "진행 의도",
                "후속 질문",
                "민감도",
                "예상 시간"
            );
    }

    @Test
    void rejectsUnknownProjectionBeforeReturningContent() {
        assertThatThrownBy(() -> projectionBusiness.projection(7L, "PUBLIC"))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_BAD_REQUEST)
            );
    }

    private DiscussionGuideResponse archivedGuide() {
        return DiscussionGuideResponse.builder()
            .guideId(7L)
            .reflectionId(3L)
            .interviewId(5L)
            .sessionId(4L)
            .depth("SIMPLE")
            .purpose("THOUGHT_EXPANSION")
            .audienceMode("SMALL_GROUP")
            .targetMinutes(20)
            .disclosureMode("PRIVATE_CONTEXT")
            .goal("책을 함께 읽은 관점을 넓힌다.")
            .issues(List.of("첫 논점", "둘째 논점"))
            .status("ARCHIVED")
            .guideVersion(1)
            .origin("GENERATED")
            .current(false)
            .currentGuideId(8L)
            .items(List.of(
                item(
                    1L,
                    1,
                    "WARM_UP",
                    "# 첫 질문",
                    "서로 다른 첫인상을 연다.",
                    "ANSWER",
                    "민감 답변 원문",
                    true
                ),
                item(
                    2L,
                    2,
                    "INTERPRETATION",
                    "둘째 질문",
                    "본문 해석을 비교한다.",
                    "REFLECTION",
                    "현재 Reflection 근거",
                    false
                )
            ))
            .build();
    }

    private DiscussionQuestionDto item(
        Long itemId,
        int order,
        String stage,
        String question,
        String intent,
        String sourceType,
        String sourceExcerpt,
        boolean privateSource
    ) {
        return DiscussionQuestionDto.builder()
            .itemId(itemId)
            .questionId(itemId + 100)
            .stage(stage)
            .priority("REQUIRED")
            .order(order)
            .question(question)
            .intent(intent)
            .sourceType(sourceType)
            .sourceRefId(itemId + 200)
            .sourceExcerpt(sourceExcerpt)
            .privateSource(privateSource)
            .sensitivity("LOW")
            .skippable(true)
            .expectedMinutes(10)
            .followUps(List.of("왜 그렇게 생각하나요?"))
            .build();
    }
}
