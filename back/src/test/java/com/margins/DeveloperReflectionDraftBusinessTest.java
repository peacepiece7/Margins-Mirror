package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiException;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftBusiness;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftProperties;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import jakarta.validation.Validation;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class DeveloperReflectionDraftBusinessTest {
    private final BookMapper bookMapper = mock(BookMapper.class);
    private final PersonaMapper personaMapper = mock(PersonaMapper.class);
    private final GenerationLocaleResolver localeResolver = mock(GenerationLocaleResolver.class);
    private final OpenAiResponsesTransport transport = mock(OpenAiResponsesTransport.class);
    private final AiGenerationObserver observer = mock(AiGenerationObserver.class);
    private final DeveloperReflectionDraftProperties properties = enabledProperties();
    private final MockEnvironment environment = new MockEnvironment().withProperty(
        "margins.ai.provider",
        "openai"
    );
    private final DeveloperReflectionDraftBusiness business = business();

    @AfterEach
    void clearProviderOverride() {
        ReflectionTestUtils.setField(business, "provider", "openai");
    }

    @Test
    void rejectsDisabledAndProductionLikeRuntimesAsNotFound() {
        properties.setEnabled(false);
        environment.setActiveProfiles("test");

        assertNotFound(() -> business.generate(request()));
        verify(bookMapper, never()).findByIdForUser(any(), any());

        properties.setEnabled(true);
        environment.setActiveProfiles("prod");
        properties.setRuntimeEnvironment("");
        assertNotFound(() -> business.generate(request()));
    }

    @Test
    void developmentRuntimeAllowsProdProfileButStillRequiresOwnedBook() {
        environment.setActiveProfiles("prod");
        properties.setRuntimeEnvironment("development");
        when(bookMapper.findByIdForUser(7L, 1L)).thenReturn(null);

        assertNotFound(() -> business.generate(request()));
        verify(bookMapper).findByIdForUser(7L, 1L);
    }

    @Test
    void asksLunaWithoutReasoningAndReturnsTwoDistinctActivePersonas() {
        arrangeOwnedBookAndLocale();
        when(personaMapper.findActiveForUser(1L)).thenReturn(List.of(
            persona(11L, "기자"),
            persona(12L, "개발자"),
            persona(13L, "변호사"),
            persona(11L, "중복 기자")
        ));
        AtomicReference<ObjectNode> sent = new AtomicReference<>();
        when(transport.execute(any())).thenAnswer(invocation -> {
            sent.set(invocation.getArgument(0));
            return new OpenAiResponsesTransport.TextResponse(
                "completed",
                "",
                "서로 다른 관점을 엮은 초안입니다.",
                new AiTokenUsage(30, 5, 12, 42),
                "gpt-6-luna-2026-10-01"
            );
        });

        var result = business.generate(request());

        assertThat(result.getContent()).isEqualTo("서로 다른 관점을 엮은 초안입니다.");
        assertThat(result.getModel()).isEqualTo("gpt-6-luna-2026-10-01");
        assertThat(result.getPersonas()).hasSize(2);
        assertThat(result.getPersonas()).extracting("personaId").doesNotHaveDuplicates();
        assertThat(result.getPersonas()).extracting("personaId")
            .allMatch(id -> List.of(11L, 12L, 13L).contains(id));
        assertThat(sent.get().path("model").asText()).isEqualTo("gpt-6-luna");
        assertThat(sent.get().path("reasoning").path("effort").asText()).isEqualTo("none");
        assertThat(sent.get().path("store").asBoolean()).isFalse();
        assertThat(sent.get().path("max_output_tokens").asInt()).isEqualTo(500);
        ArgumentCaptor<AiGenerationResult<?>> event = ArgumentCaptor.forClass(
            AiGenerationResult.class
        );
        verify(observer).observe(event.capture(), eq(null), eq(true));
        assertThat(event.getValue().taskType()).isEqualTo("DEVELOPER_DEBUG_DRAFT");
        assertThat(event.getValue().model()).isEqualTo("gpt-6-luna-2026-10-01");
        assertThat(event.getValue().inputTokens()).isEqualTo(30);
        assertThat(event.getValue().outputTokens()).isEqualTo(12);
        assertThat(event.getValue().outcome()).isEqualTo("SUCCESS");
    }

    @Test
    void configuredProviderFailureIsObservedAndMappedToBadGateway() {
        arrangeOwnedBookAndLocale();
        when(personaMapper.findActiveForUser(1L)).thenReturn(List.of());
        when(transport.execute(any())).thenThrow(new IllegalStateException("provider failed"));

        assertThatThrownBy(() -> business.generate(request()))
            .isInstanceOfSatisfying(ApiException.class, exception -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
            });
        verify(observer).observe(any(AiGenerationResult.class), eq(null), eq(true));
    }

    @Test
    void placeholderIsDeterministicAndDoesNotCreateProviderCostEvent() {
        arrangeOwnedBookAndLocale();
        when(personaMapper.findActiveForUser(1L)).thenReturn(List.of(persona(11L, "기자")));
        ReflectionTestUtils.setField(business, "provider", "placeholder");

        var result = business.generate(request());

        assertThat(result.getModel()).isEqualTo("placeholder");
        assertThat(result.getContent()).contains("인물의 선택");
        assertThat(result.getPersonas()).extracting("displayName").containsExactly("기자");
        verify(transport, never()).execute(any());
        verify(observer, never()).observe(any(), any(), eq(true));
    }

    @Test
    void requestValidationBoundsTargetBookAndContext() {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            var validator = validatorFactory.getValidator();
            var invalid = DeveloperReflectionDraftRequest.builder()
                .bookId(0L)
                .subject("s".repeat(2001))
                .context("c".repeat(8001))
                .build();

            assertThat(validator.validate(invalid)).extracting("propertyPath").map(Object::toString)
                .containsExactlyInAnyOrder("target", "bookId", "subject", "context");
        }
    }

    private DeveloperReflectionDraftBusiness business() {
        environment.setActiveProfiles("test");
        DeveloperReflectionDraftBusiness value = new DeveloperReflectionDraftBusiness(
            properties,
            environment,
            bookMapper,
            personaMapper,
            localeResolver,
            transport,
            new ObjectMapper(),
            observer
        );
        ReflectionTestUtils.setField(value, "provider", "openai");
        return value;
    }

    private void arrangeOwnedBookAndLocale() {
        when(bookMapper.findByIdForUser(7L, 1L)).thenReturn(BookRecord.builder()
            .id(7L)
            .userId(1L)
            .title("테스트 책")
            .author("테스트 작가")
            .description("선택과 책임을 다루는 책")
            .build());
        when(localeResolver.resolve(1L)).thenReturn(GenerationLocale.KO);
    }

    private DeveloperReflectionDraftRequest request() {
        return DeveloperReflectionDraftRequest.builder()
            .target("INTERVIEW_ANSWER")
            .bookId(7L)
            .subject("왜 이런 선택을 했을까요?")
            .context("현재 입력은 아직 저장되지 않았습니다.")
            .build();
    }

    private PersonaRecord persona(Long id, String displayName) {
        return PersonaRecord.builder()
            .id(id)
            .displayName(displayName)
            .description(displayName + "의 관점")
            .tone("차분함")
            .systemPrompt("근거를 살펴본다")
            .active(true)
            .build();
    }

    private DeveloperReflectionDraftProperties enabledProperties() {
        DeveloperReflectionDraftProperties value = new DeveloperReflectionDraftProperties();
        value.setEnabled(true);
        value.setModel("gpt-6-luna");
        value.setMaxOutputTokens(500);
        return value;
    }

    private void assertNotFound(Runnable runnable) {
        assertThatThrownBy(runnable::run)
            .isInstanceOfSatisfying(ApiException.class, exception -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            });
    }
}
