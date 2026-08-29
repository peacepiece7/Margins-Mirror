package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionListResponse;
import com.margins.reflectionloop.ai.ReflectionQuestionGenerator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ReflectionQuestionGeneratorTest {

    @Test
    void ordinaryProviderFallbackKeepsNullableLanguageValidation() {
        AiProvider provider = mock(AiProvider.class);
        when(provider.suggestQuestionsWithMetadata(eq(20L), any(), any())).thenAnswer(invocation ->
            AiGenerationResult.completed(
                QuestionListResponse.builder().questions(List.of(
                    QuestionDto.builder().questionText("Which scene matters most?")
                        .aiModel("placeholder").build()
                )).build(),
                invocation.getArgument(2),
                "placeholder",
                "placeholder",
                AiTokenUsage.NONE,
                0,
                "FALLBACK",
                true
            )
        );
        ReflectionQuestionGenerator generator = new ReflectionQuestionGenerator(provider);

        var draft = generator.generate(
            20L,
            "Initial thought",
            "ALTERNATIVE_VIEW",
            false,
            List.of("First question"),
            List.of("First answer"),
            GenerationLocale.EN
        );

        assertThat(draft.question()).isEqualTo("Which scene matters most?");
        assertThat(draft.generationLocale()).isEqualTo("en");
        assertThat(draft.languageValidationOutcome()).isNull();
    }

    @Test
    void groundsTheNextQuestionPromptInPreviousAnswers() {
        AiProvider provider = mock(AiProvider.class);
        ArgumentCaptor<GenerateQuestionsRequest> request = ArgumentCaptor.forClass(
            GenerateQuestionsRequest.class
        );
        when(provider.suggestQuestionsWithMetadata(eq(20L), request.capture(), any()))
            .thenAnswer(invocation -> AiGenerationResult.completed(
                QuestionListResponse.builder().questions(List.of()).build(),
                invocation.getArgument(2),
                "openai",
                "model",
                AiTokenUsage.NONE,
                0,
                "SUCCESS",
                false
            ));
        ReflectionQuestionGenerator generator = new ReflectionQuestionGenerator(provider);

        var draft = generator.generate(
            20L,
            "처음 생각",
            "ALTERNATIVE_VIEW",
            false,
            List.of("첫 질문"),
            List.of("침묵은 회피이면서 보호일 수도 있다고 답했다."),
            com.margins.ai.GenerationLocale.KO
        );

        assertThat(request.getValue().getFocus())
            .contains("이전 질문: 첫 질문")
            .contains("이전 답변: 침묵은 회피이면서 보호일 수도 있다고 답했다.");
        assertThat(draft.question()).isNotBlank();
        assertThat(draft.model()).isEqualTo("reflection-loop-fallback");
    }

    @Test
    void englishInterviewRequestUsesEnglishControlInstructionsOnly() {
        AiProvider provider = mock(AiProvider.class);
        ArgumentCaptor<GenerateQuestionsRequest> request = ArgumentCaptor.forClass(
            GenerateQuestionsRequest.class
        );
        when(provider.suggestQuestionsWithMetadata(eq(20L), request.capture(), any()))
            .thenAnswer(invocation -> AiGenerationResult.completed(
                QuestionListResponse.builder().questions(List.of(
                    QuestionDto.builder().questionText("Which passage best supports that view?")
                        .aiModel("model").build()
                )).build(),
                invocation.getArgument(2),
                "openai",
                "model",
                AiTokenUsage.NONE,
                0,
                "SUCCESS",
                false
            ));

        new ReflectionQuestionGenerator(provider).generate(
            20L,
            "The character's silence may be protective.",
            "ALTERNATIVE_VIEW",
            false,
            List.of("What first stood out?"),
            List.of("The final scene."),
            GenerationLocale.EN
        );

        assertThat(request.getValue().getFocus())
            .contains(
                "Current Reflection:",
                "Generate exactly one question that does not repeat a previous question.",
                "Do not pressure the reader to disclose private information."
            )
            .doesNotContain(
                "현재 Reflection:",
                "이전 질문과 겹치지 않게 질문 한 개만 생성하세요.",
                "개인 정보 공개를 강요하지 않기"
            );
    }
}
