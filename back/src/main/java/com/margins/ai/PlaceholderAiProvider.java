package com.margins.ai;

import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import java.util.List;
import java.util.function.Consumer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "margins.ai.provider", havingValue = "placeholder", matchIfMissing = true)
public class PlaceholderAiProvider implements AiProvider {

    @Override
    public AiGenerationResult<QuestionListResponse> suggestQuestionsWithMetadata(
        Long windowId,
        GenerateQuestionsRequest request,
        AiGenerationTask task
    ) {
        return fallbackResult(questions(windowId, request, task.generationLocale()), task);
    }

    @Override
    public AiGenerationResult<AiMessageResponse> answerWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    ) {
        return fallbackResult(windowMessage(windowId, request, task.generationLocale()), task);
    }

    @Override
    public AiGenerationResult<AiMessageResponse> streamWindowMessageWithMetadata(
        Long windowId,
        SendMessageRequest request,
        Consumer<String> deltaConsumer,
        AiGenerationTask task
    ) {
        AiMessageResponse response = windowMessage(windowId, request, task.generationLocale());
        chunks(response.getContent()).forEach(deltaConsumer);
        return fallbackResult(response, task);
    }

    @Override
    public AiGenerationResult<AiMessageResponse> answerDebateMessageWithMetadata(
        Long windowId,
        DebateMessageRequest request,
        AiGenerationTask task
    ) {
        return fallbackResult(personaMessage(windowId, request, task.generationLocale()), task);
    }

    @Override
    public AiGenerationResult<List<AiMessageResponse>> answerDebateMessagesWithMetadata(
        Long windowId,
        List<DebateMessageRequest> requests,
        AiGenerationTask task
    ) {
        List<AiMessageResponse> responses = requests == null
            ? List.of()
            : requests.stream()
                .map(request -> personaMessage(windowId, request, task.generationLocale()))
                .toList();
        return fallbackResult(responses, task);
    }

    private QuestionListResponse questions(
        Long windowId,
        GenerateQuestionsRequest request,
        GenerationLocale locale
    ) {
        int count = request.getCount() == null ? 3 : request.getCount();
        String focus = request.getFocus() == null || request.getFocus().isBlank()
            ? locale == GenerationLocale.KO ? "이번 독서" : "this reading"
            : request.getFocus();

        List<QuestionDto> questions = locale == GenerationLocale.KO ? List.of(
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
        ) : List.of(
            QuestionDto.builder().windowId(windowId).questionType("reflection").status("active")
                .aiModel("placeholder")
                .questionText("Which scene in " + focus + " most changed how you understood the book?").build(),
            QuestionDto.builder().windowId(windowId).questionType("evidence").status("active")
                .aiModel("placeholder")
                .questionText("Which passage best supports your current interpretation?").build(),
            QuestionDto.builder().windowId(windowId).questionType("connection").status("active")
                .aiModel("placeholder")
                .questionText("Which tension or contrast would be most useful to explore next?").build()
        );

        return QuestionListResponse.builder()
            .questions(questions.subList(0, Math.min(count, questions.size())))
            .build();
    }

    private AiMessageResponse windowMessage(
        Long windowId,
        SendMessageRequest request,
        GenerationLocale locale
    ) {
        String content = locale == GenerationLocale.KO
            ? "임시 독서 응답입니다. 방금 남긴 답변에서 근거가 되는 장면이나 문장을 하나 고르고, 그 근거가 해석을 어떻게 바꾸는지 이어서 정리해 보세요. 입력: "
                + summarize(request.getContent(), locale)
            : "This is a temporary reading response. Choose one scene or sentence as evidence, then explain how it changes your interpretation. Input: "
                + summarize(request.getContent(), locale);

        return AiMessageResponse.builder()
            .messageId(null)
            .windowId(windowId)
            .role("assistant")
            .content(content)
            .streamingReady(true)
            .aiModel("placeholder")
            .build();
    }

    private AiMessageResponse personaMessage(
        Long windowId,
        DebateMessageRequest request,
        GenerationLocale locale
    ) {
        String content = locale == GenerationLocale.KO
            ? "임시 토론 응답입니다. 먼저 주장을 한 문장으로 세우고, 그 주장을 지지하는 근거와 반대 관점에서 확인할 질문을 나눠 보겠습니다. 입력: "
                + summarize(request.getContent(), locale)
            : "This is a temporary discussion response. State the claim in one sentence, identify supporting evidence, and test it from an opposing view. Input: "
                + summarize(request.getContent(), locale);

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

    private String summarize(String content, GenerationLocale locale) {
        if (content == null || content.isBlank()) {
            return locale == GenerationLocale.KO ? "내용 없음" : "No content";
        }
        String trimmed = content.trim();
        return trimmed.length() <= 80 ? trimmed : trimmed.substring(0, 80) + "...";
    }

    private <T> AiGenerationResult<T> fallbackResult(T value, AiGenerationTask task) {
        return AiGenerationResult.completed(
            value, task, "placeholder", "placeholder", AiTokenUsage.NONE, 0, "FALLBACK", true
        );
    }

    private List<String> chunks(String content) {
        String safe = content == null ? "" : content;
        java.util.ArrayList<String> chunks = new java.util.ArrayList<>();
        for (int start = 0; start < safe.length(); start += 24) {
            chunks.add(safe.substring(start, Math.min(start + 24, safe.length())));
        }
        return chunks.isEmpty() ? List.of("") : List.copyOf(chunks);
    }
}
