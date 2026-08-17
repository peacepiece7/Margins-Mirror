package com.margins.ai;

import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "margins.ai.provider", havingValue = "placeholder", matchIfMissing = true)
public class PlaceholderAiProvider implements AiProvider {

    @Override
    public QuestionListResponse suggestQuestions(Long windowId, GenerateQuestionsRequest request) {
        int count = request.getCount() == null ? 3 : request.getCount();
        String focus = request.getFocus() == null || request.getFocus().isBlank()
            ? "이번 독서"
            : request.getFocus();

        List<QuestionDto> questions = List.of(
            QuestionDto.builder()
                .windowId(windowId)
                .questionType("reflection")
                .status("active")
                .aiModel("placeholder")
                .questionText(focus + "에서 어떤 장면이 이 책을 이해하는 방식을 바꾸었나요?")
                .build(),
            QuestionDto.builder()
                .windowId(windowId)
                .questionType("evidence")
                .status("active")
                .aiModel("placeholder")
                .questionText("지금의 해석을 뒷받침하는 근거로 어떤 구절을 고르겠나요?")
                .build(),
            QuestionDto.builder()
                .windowId(windowId)
                .questionType("connection")
                .status("active")
                .aiModel("placeholder")
                .questionText("다음 대화에서는 어떤 긴장감이나 대비를 더 탐구하면 좋을까요?")
                .build()
        );

        return QuestionListResponse.builder()
            .questions(questions.subList(0, Math.min(count, questions.size())))
            .build();
    }

    @Override
    public AiMessageResponse answerWindowMessage(Long windowId, SendMessageRequest request) {
        String content = "임시 독서 응답입니다. "
            + "방금 남긴 답변에서 근거가 되는 장면이나 문장을 하나 고르고, 그 근거가 해석을 어떻게 바꾸는지 이어서 정리해 보세요. "
            + "입력: "
            + summarize(request.getContent());

        return AiMessageResponse.builder()
            .messageId(null)
            .windowId(windowId)
            .role("assistant")
            .content(content)
            .streamingReady(true)
            .aiModel("placeholder")
            .build();
    }

    @Override
    public AiMessageResponse answerDebateMessage(Long windowId, DebateMessageRequest request) {
        String content = "임시 토론 응답입니다. "
            + "먼저 주장을 한 문장으로 세우고, 그 주장을 지지하는 근거와 반대 관점에서 확인할 질문을 나눠 보겠습니다. "
            + "입력: "
            + summarize(request.getContent());

        return AiMessageResponse.builder()
            .messageId(null)
            .windowId(windowId)
            .role("assistant")
            .personaId(request.getPersonaId())
            .content(content)
            .streamingReady(true)
            .aiModel("placeholder")
            .build();
    }

    private String summarize(String content) {
        if (content == null || content.isBlank()) {
            return "내용 없음";
        }
        String trimmed = content.trim();
        return trimmed.length() <= 80 ? trimmed : trimmed.substring(0, 80) + "...";
    }
}
