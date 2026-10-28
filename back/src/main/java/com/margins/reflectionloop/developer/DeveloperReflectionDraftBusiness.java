package com.margins.reflectionloop.developer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.margins.ai.transport.OpenAiResponsesTransport.OpenAiResponsesException;
import com.margins.auth.support.AuthContext;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DeveloperReflectionDraftBusiness {
    private static final int MAX_RESPONSE_LENGTH = 5000;
    private static final String PROMPT_VERSION = "developer-reflection-draft-v1";

    private final DeveloperReflectionDraftProperties properties;
    private final Environment environment;
    private final BookMapper bookMapper;
    private final PersonaMapper personaMapper;
    private final GenerationLocaleResolver localeResolver;
    private final OpenAiResponsesTransport responsesTransport;
    private final ObjectMapper objectMapper;
    private final AiGenerationObserver generationObserver;

    @Value("${margins.ai.provider:openai}")
    private String provider;

    public DeveloperReflectionDraftResponse generate(DeveloperReflectionDraftRequest request) {
        requireEnabledEnvironment();
        Long userId = AuthContext.requireUserId();
        BookRecord book = bookMapper.findByIdForUser(request.getBookId(), userId);
        if (book == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book not found");
        }

        GenerationLocale locale = localeResolver.resolve(userId);
        List<PersonaRecord> personas = selectPersonas(personaMapper.findActiveForUser(userId));
        DeveloperReflectionDraftTarget target = DeveloperReflectionDraftTarget.valueOf(
            request.getTarget()
        );
        if ("placeholder".equalsIgnoreCase(provider)) {
            return placeholder(target, locale, personas);
        }
        return requestOpenAi(request, book, locale, personas);
    }

    private DeveloperReflectionDraftResponse requestOpenAi(
        DeveloperReflectionDraftRequest request,
        BookRecord book,
        GenerationLocale locale,
        List<PersonaRecord> personas
    ) {
        AiGenerationTask task = new AiGenerationTask(
            "DEVELOPER_DEBUG_DRAFT",
            PROMPT_VERSION,
            "text-v1",
            locale
        );
        long startedAt = System.nanoTime();
        AiTokenUsage tokenUsage = AiTokenUsage.NONE;
        String model = properties.getModel();
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", properties.getModel());
            body.put("max_output_tokens", properties.getMaxOutputTokens());
            body.put("store", false);
            body.putObject("reasoning").put("effort", "none");
            ArrayNode input = body.putArray("input");
            input.add(message("developer", instructions(locale)));
            input.add(message("user", prompt(request, book, personas)));

            OpenAiResponsesTransport.TextResponse generated = responsesTransport.execute(body);
            tokenUsage = generated.tokenUsage();
            model = generated.model();
            if (!"completed".equals(generated.status()) || generated.outputText().isBlank()) {
                throw new IllegalStateException("Developer draft response was not completed");
            }
            String content = truncate(generated.outputText().trim(), MAX_RESPONSE_LENGTH);
            generationObserver.observe(AiGenerationResult.completed(
                content,
                task,
                "openai",
                model,
                tokenUsage,
                elapsedMillis(startedAt),
                "SUCCESS",
                false
            ), null, isTestRuntime());
            return response(content, model, personas);
        } catch (RuntimeException exception) {
            generationObserver.observe(AiGenerationResult.failure(
                task,
                "openai",
                model,
                tokenUsage,
                elapsedMillis(startedAt),
                failureCategory(exception)
            ), null, isTestRuntime());
            throw new ApiException(
                ApiErrorCode.COMMON_UPSTREAM_ERROR,
                "Developer Reflection draft generation failed",
                exception
            );
        }
    }

    private DeveloperReflectionDraftResponse placeholder(
        DeveloperReflectionDraftTarget target,
        GenerationLocale locale,
        List<PersonaRecord> personas
    ) {
        String content = locale == GenerationLocale.KO
            ? switch (target) {
                case PRIMARY_REFLECTION -> "처음에는 단순한 이야기로 보였지만, 인물의 선택을 따라가며 제 생각도 함께 흔들렸습니다.";
                case QUESTION_ANSWER, INTERVIEW_ANSWER -> "이 질문을 생각해 보니 인물의 선택에는 두려움과 책임감이 동시에 작용했다고 느꼈습니다.";
                case DISCUSSION_TURN -> "저는 이 장면이 정답을 제시하기보다 우리가 무엇을 책임져야 하는지 되묻는다고 생각합니다.";
            }
            : switch (target) {
                case PRIMARY_REFLECTION -> "At first the story felt simple, but following the character's choice unsettled my own assumptions.";
                case QUESTION_ANSWER, INTERVIEW_ANSWER -> "The question makes me think the character was moved by fear and responsibility at the same time.";
                case DISCUSSION_TURN -> "I read this scene as a question about what we are willing to take responsibility for, not as a fixed answer.";
            };
        return response(content, "placeholder", personas);
    }

    private List<PersonaRecord> selectPersonas(List<PersonaRecord> active) {
        if (active == null || active.isEmpty()) {
            return List.of();
        }
        Set<Long> seenIds = new HashSet<>();
        List<PersonaRecord> shuffled = new ArrayList<>(active.stream()
            // PersonaMapper.findActiveForUser already enforces is_active=TRUE in SQL.
            .filter(persona -> persona.getId() != null)
            .filter(persona -> seenIds.add(persona.getId()))
            .toList());
        Collections.shuffle(shuffled);
        return List.copyOf(shuffled.subList(0, Math.min(2, shuffled.size())));
    }

    private String instructions(GenerationLocale locale) {
        return locale.languageInstruction() + " " + """
            Write one concise, natural first-person draft for a reader of the supplied book.
            Blend the supplied perspectives into one coherent voice without naming or role-playing
            the personas. Do not claim facts, quotations, scenes, or personal experiences that are
            absent from the input. Return only the draft, with no heading or explanation.
            """;
    }

    private String prompt(
        DeveloperReflectionDraftRequest request,
        BookRecord book,
        List<PersonaRecord> personas
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Target: ").append(request.getTarget()).append('\n');
        prompt.append("Book title: ").append(safe(book.getTitle(), 300)).append('\n');
        prompt.append("Book author: ").append(safe(book.getAuthor(), 200)).append('\n');
        append(prompt, "Book description", book.getDescription(), 1500);
        append(prompt, "Subject", request.getSubject(), 2000);
        append(prompt, "Current context", request.getContext(), 8000);
        if (personas.isEmpty()) {
            prompt.append("Perspective: a thoughtful general reader\n");
        } else {
            for (int index = 0; index < personas.size(); index++) {
                PersonaRecord persona = personas.get(index);
                prompt.append("Perspective ").append(index + 1).append(": ")
                    .append(safe(persona.getDescription(), 800)).append("; tone=")
                    .append(safe(persona.getTone(), 200)).append("; guidance=")
                    .append(safe(persona.getSystemPrompt(), 1200)).append('\n');
            }
        }
        return prompt.toString();
    }

    private ObjectNode message(String role, String content) {
        ObjectNode message = objectMapper.createObjectNode();
        message.put("role", role);
        message.put("content", content);
        return message;
    }

    private DeveloperReflectionDraftResponse response(
        String content,
        String model,
        List<PersonaRecord> personas
    ) {
        return DeveloperReflectionDraftResponse.builder()
            .content(content)
            .model(model)
            .personas(personas.stream().map(persona ->
                DeveloperReflectionDraftResponse.PersonaSummary.builder()
                    .personaId(persona.getId())
                    .displayName(persona.getDisplayName())
                    .build()
            ).toList())
            .build();
    }

    private void requireEnabledEnvironment() {
        boolean permittedRuntime = environment.acceptsProfiles(Profiles.of("local", "test"))
            || "development".equals(properties.getRuntimeEnvironment());
        if (!properties.isEnabled() || !permittedRuntime) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Developer endpoint is disabled");
        }
    }

    private boolean isTestRuntime() {
        return environment.acceptsProfiles(Profiles.of("local", "test"));
    }

    private String failureCategory(RuntimeException exception) {
        if (exception instanceof OpenAiResponsesException transport) {
            return transport.isTimeout() ? "TIMEOUT" : "TRANSPORT";
        }
        String message = exception.getMessage();
        if (message != null && message.toLowerCase(Locale.ROOT).contains("refused")) {
            return "REFUSAL";
        }
        return "MALFORMED_OUTPUT";
    }

    private void append(StringBuilder target, String label, String value, int limit) {
        if (value != null && !value.isBlank()) {
            target.append(label).append(": ").append(safe(value, limit)).append('\n');
        }
    }

    private String safe(String value, int limit) {
        return truncate(value == null || value.isBlank() ? "unknown" : value.trim(), limit);
    }

    private String truncate(String value, int limit) {
        return value.length() <= limit ? value : value.substring(0, limit);
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - startedAt) / 1_000_000L);
    }
}
