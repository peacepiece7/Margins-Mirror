package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.ai.AiProvider;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionListResponse;
import com.margins.reflectionloop.ai.ReflectionQuestionGenerator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ReflectionQuestionGeneratorTest {

    @Test
    void groundsTheNextQuestionPromptInPreviousAnswers() {
        AiProvider provider = mock(AiProvider.class);
        ArgumentCaptor<GenerateQuestionsRequest> request = ArgumentCaptor.forClass(
            GenerateQuestionsRequest.class
        );
        when(provider.suggestQuestions(eq(20L), request.capture())).thenReturn(
            QuestionListResponse.builder().questions(List.of()).build()
        );
        ReflectionQuestionGenerator generator = new ReflectionQuestionGenerator(provider);

        var draft = generator.generate(
            20L,
            "처음 생각",
            "ALTERNATIVE_VIEW",
            false,
            List.of("첫 질문"),
            List.of("침묵은 회피이면서 보호일 수도 있다고 답했다.")
        );

        assertThat(request.getValue().getFocus())
            .contains("이전 질문: 첫 질문")
            .contains("이전 답변: 침묵은 회피이면서 보호일 수도 있다고 답했다.");
        assertThat(draft.question()).isNotBlank();
        assertThat(draft.model()).isEqualTo("reflection-loop-fallback");
    }
}
