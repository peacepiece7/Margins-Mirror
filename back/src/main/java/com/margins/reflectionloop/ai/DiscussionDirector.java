package com.margins.reflectionloop.ai;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import com.margins.reflectionloop.model.DiscussionGuideItemRecord;
import com.margins.persona.model.PersonaRecord;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.SendMessageRequest;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DiscussionDirector {
    private static final Set<String> ALLOWED_ACTIONS = Set.of(
        "ASK_FOLLOW_UP",
        "CALL_PERSPECTIVE",
        "MOVE_NEXT_TOPIC",
        "SUMMARIZE_TOPIC",
        "FINISH_DISCUSSION"
    );
    private final AiProvider aiProvider;
    private final ObjectMapper objectMapper;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;
    private final AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    public DirectorDecision decide(
        Long windowId,
        DiscussionGuideItemRecord current,
        List<DiscussionGuideItemRecord> items,
        String content,
        String navigation,
        GenerationLocale locale
    ) {
        return decide(
            windowId, current, items, content, navigation,
            "discussion-director-v1", null, false, List.of(), locale
        );
    }

    public DirectorDecision decide(
        Long windowId, DiscussionGuideItemRecord current,
        List<DiscussionGuideItemRecord> items, String content, String navigation,
        String promptVersion, String depth, boolean testData,
        List<PersonaRecord> personas, GenerationLocale locale
    ) {
        if ("FINISH".equals(navigation)) {
            return ruleDecision("FINISH_DISCUSSION", null, locale);
        }
        DiscussionGuideItemRecord next = next(items, current);
        if ("NEXT".equals(navigation)) {
            return ruleDecision(
                next == null ? "FINISH_DISCUSSION" : "MOVE_NEXT_TOPIC",
                next,
                locale
            );
        }
        AiGenerationTask task = new AiGenerationTask(
            "DISCUSSION_DIRECTOR",
            promptVersion,
            "director-action-v1",
            locale
        );
        AiGenerationResult<AiMessageResponse> generation = null;
        try {
            SendMessageRequest request = SendMessageRequest.builder()
                    .questionId(current.getQuestionId())
                    .content(prompt(current, content, personas, locale))
                    .build();
            generation = aiProvider.answerWindowMessageWithMetadata(windowId, request, task);
            if (generation == null) {
                generation = AiGenerationResult.failure(task, "unknown", "unknown", 0);
            }
            AiMessageResponse response = generation.value();
            DirectorPayload parsed = parsePayload(
                response == null ? null : response.getContent(),
                personas
            );
            if (parsed == null) {
                generationObserver.observe(
                    generation.withOutcome("FALLBACK", true),
                    depth,
                    testData
                );
                return safeFallback(current, locale, null);
            }
            String displayContent = displayContent(parsed.reply(), parsed.focus(), locale);
            AiLanguageValidationOutcome validation = generation.fallbackUsed()
                && generation.languageValidationOutcome() == null
                    ? null
                    : languageValidator.validate(locale, displayContent);
            if (validation == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
                generationObserver.observe(
                    generation.withOutcome("FALLBACK", true).withLanguageValidation(validation),
                    depth,
                    testData
                );
                return safeFallback(current, locale, validation);
            }
            if (validation != null) {
                generation = generation.withLanguageValidation(validation);
            }
            generationObserver.observe(generation, depth, testData);
            String action = parsed.action();
            if ("MOVE_NEXT_TOPIC".equals(action) && next == null) {
                return new DirectorDecision(
                    "SUMMARIZE_TOPIC",
                    current,
                    List.of(),
                    parsed.reply(),
                    parsed.focus(),
                    displayContent,
                    locale,
                    validation
                );
            }
            return new DirectorDecision(
                action,
                switch (action) {
                    case "MOVE_NEXT_TOPIC" -> next;
                    case "FINISH_DISCUSSION" -> null;
                    default -> current;
                },
                parsed.candidatePersonaIds(),
                parsed.reply(),
                parsed.focus(),
                displayContent,
                locale,
                validation
            );
        } catch (RuntimeException exception) {
            AiGenerationResult<AiMessageResponse> fallbackGeneration = generation == null
                ? AiGenerationResult.<AiMessageResponse>failure(
                    task,
                    "unknown",
                    "unknown",
                    0
                ).withOutcome("FALLBACK", true)
                : generation.withOutcome("FALLBACK", true);
            generationObserver.observe(
                fallbackGeneration,
                depth,
                testData
            );
            return safeFallback(current, locale, null);
        }
    }

    private DirectorDecision safeFallback(
        DiscussionGuideItemRecord current,
        GenerationLocale locale,
        AiLanguageValidationOutcome validationOutcome
    ) {
        return decision(
            "ASK_FOLLOW_UP",
            current,
            List.of(),
            locale == GenerationLocale.KO
                ? "이 지점에서 한 문장만 더 구체화해 볼까요?"
                : "Could you make that point one sentence more specific?",
            locale == GenerationLocale.KO ? "현재 쟁점" : "Current focus",
            locale,
            validationOutcome
        );
    }

    public DirectorDecision ruleDecision(
        String action,
        DiscussionGuideItemRecord target,
        GenerationLocale locale
    ) {
        String reply = switch (action) {
            case "ASK_FOLLOW_UP" -> locale == GenerationLocale.KO
                ? "좋아요. 지금 답에서 가장 중요한 근거나 망설임을 한 문장만 더 구체화해 볼까요?"
                : "Good. Could you make the most important evidence or hesitation one sentence more specific?";
            case "MOVE_NEXT_TOPIC" -> target == null
                ? locale == GenerationLocale.KO
                    ? "여기까지의 생각을 정리하고 토론을 마무리해 볼까요?"
                    : "Shall we summarize the discussion so far and bring it to a close?"
                : locale == GenerationLocale.KO
                    ? "좋아요. 다음은 “" + target.getQuestionText() + "”를 살펴보겠습니다."
                    : "Good. Next, let's consider: “" + target.getQuestionText() + "”";
            case "FINISH_DISCUSSION" -> locale == GenerationLocale.KO
                ? "지금까지의 관점을 바탕으로 처음 Reflection을 유지하거나 다듬어 보세요."
                : "Use the perspectives so far to keep or refine your initial reflection.";
            case "SUMMARIZE_TOPIC" -> locale == GenerationLocale.KO
                ? "이 주제에서 확인한 핵심을 한 문장으로 정리해 보겠습니다."
                : "Let's summarize the key point from this topic in one sentence.";
            default -> locale == GenerationLocale.KO
                ? "이 지점에서 한 문장만 더 구체화해 볼까요?"
                : "Could you make that point one sentence more specific?";
        };
        return decision(
            action,
            target,
            List.of(),
            reply,
            null,
            locale,
            languageValidator.validate(locale, reply)
        );
    }

    private DirectorDecision decision(
        String action,
        DiscussionGuideItemRecord target,
        List<Long> candidatePersonaIds,
        String reply,
        String focus,
        GenerationLocale locale,
        AiLanguageValidationOutcome validationOutcome
    ) {
        return new DirectorDecision(
            action,
            target,
            candidatePersonaIds,
            reply,
            focus,
            displayContent(reply, focus, locale),
            locale,
            validationOutcome
        );
    }

    private String displayContent(String reply, String focus, GenerationLocale locale) {
        if (reply == null || focus == null || focus.isBlank()) {
            return reply;
        }
        return reply
            + (locale == GenerationLocale.KO ? "\n\n이번 쟁점: " : "\n\nCurrent focus: ")
            + focus;
    }

    private String prompt(
        DiscussionGuideItemRecord current,
        String content,
        List<PersonaRecord> personas,
        GenerationLocale locale
    ) {
        String personaCatalog = personas == null || personas.isEmpty()
            ? "[]"
            : personas.stream()
                .limit(8)
                .map(persona -> "{\"personaId\":" + persona.getId()
                    + ",\"displayName\":\"" + escapeJson(persona.getDisplayName())
                    + "\",\"description\":\"" + escapeJson(persona.getDescription()) + "\"}")
                .toList()
                .toString();
        if (locale == GenerationLocale.EN) {
            return """
                [DISCUSSION_DIRECTOR]
                Current guide question: %s
                Question intent: %s
                Bounded evidence: %s
                Reader's latest answer: %s
                Available perspectives: %s
                Choose exactly one next action.
                Allowed actions: ASK_FOLLOW_UP, CALL_PERSPECTIVE, MOVE_NEXT_TOPIC,
                SUMMARIZE_TOPIC, FINISH_DISCUSSION.
                For CALL_PERSPECTIVE, put only one or two personaId values from the catalog in candidatePersonaIds.
                reply must be a brief facilitation message reflecting the reader's answer, at most 400 characters.
                focus must summarize the issue within the current Guide issue/stage, at most 200 characters.
                Return exactly one JSON object: {"action":"ALLOWED_ACTION","reply":"...","focus":"...","candidatePersonaIds":[]}.
                """.formatted(
                truncate(current.getQuestionText(), 500),
                truncate(current.getIntent(), 500),
                truncate(current.getSourceExcerpt(), 500),
                truncate(content, 2000),
                personaCatalog
            );
        }
        return """
            [DISCUSSION_DIRECTOR]
            현재 발제 질문: %s
            질문 의도: %s
            제한된 근거: %s
            독자의 최신 답변: %s
            선택 가능한 관점 목록: %s
            다음 진행 하나만 결정하세요.
            허용 action: ASK_FOLLOW_UP, CALL_PERSPECTIVE, MOVE_NEXT_TOPIC,
            SUMMARIZE_TOPIC, FINISH_DISCUSSION.
            CALL_PERSPECTIVE인 경우 candidatePersonaIds에 목록의 personaId를 1~2개만 넣으세요.
            reply는 독자의 답을 반영한 짧은 진행 안내이며 400자 이내입니다.
            focus는 현재 Guide issue/stage 안의 쟁점 요약이며 200자 이내입니다.
            정확히 {"action":"ALLOWED_ACTION","reply":"...","focus":"...","candidatePersonaIds":[]} JSON 하나만 반환하세요.
            """.formatted(
            truncate(current.getQuestionText(), 500),
            truncate(current.getIntent(), 500),
            truncate(current.getSourceExcerpt(), 500),
            truncate(content, 2000),
            personaCatalog
        );
    }

    private DirectorPayload parsePayload(String content, List<PersonaRecord> personas) {
        if (content == null || content.isBlank()) {
            return null;
        }
        try (JsonParser parser = objectMapper.getFactory().createParser(content)) {
            JsonNode root = objectMapper.readTree(parser);
            if (root == null || !root.isObject() || parser.nextToken() != null) {
                return null;
            }
            JsonNode actionNode = root.get("action");
            if (actionNode == null
                || !actionNode.isTextual()
                || !ALLOWED_ACTIONS.contains(actionNode.textValue())) {
                return null;
            }
            String reply = boundedText(root.get("reply"), 400);
            String focus = boundedText(root.get("focus"), 200);
            JsonNode candidateNode = root.get("candidatePersonaIds");
            if (reply == null || focus == null || candidateNode == null || !candidateNode.isArray()) {
                return null;
            }
            if (candidateNode.size() > 8) {
                return null;
            }

            LinkedHashSet<Long> requestedIds = new LinkedHashSet<>();
            for (JsonNode idNode : candidateNode) {
                if (!idNode.isIntegralNumber() || !idNode.canConvertToLong() || idNode.longValue() <= 0) {
                    return null;
                }
                requestedIds.add(idNode.longValue());
            }
            String action = actionNode.textValue();
            if (!"CALL_PERSPECTIVE".equals(action) && !requestedIds.isEmpty()) {
                return null;
            }

            List<PersonaRecord> available = personas == null
                ? List.of()
                : personas.stream().limit(8).toList();
            Set<Long> activeIds = available.stream()
                .map(PersonaRecord::getId)
                .collect(java.util.stream.Collectors.toSet());
            LinkedHashSet<Long> candidates = new LinkedHashSet<>();
            requestedIds.stream()
                .filter(activeIds::contains)
                .limit(2)
                .forEach(candidates::add);
            if ("CALL_PERSPECTIVE".equals(action) && candidates.isEmpty()) {
                return null;
            }
            return new DirectorPayload(action, List.copyOf(candidates), reply, focus);
        } catch (IOException | RuntimeException exception) {
            return null;
        }
    }

    private String boundedText(JsonNode node, int max) {
        if (node == null || !node.isTextual()) {
            return null;
        }
        String value = node.textValue().trim();
        return value.isBlank() || value.length() > max ? null : value;
    }

    private String escapeJson(String value) {
        return (value == null ? "" : value)
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", " ");
    }

    private String truncate(String value, int max) {
        String safe = value == null ? "" : value.trim();
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    public DiscussionGuideItemRecord next(
        List<DiscussionGuideItemRecord> items,
        DiscussionGuideItemRecord current
    ) {
        if (current == null) {
            return items.isEmpty() ? null : items.get(0);
        }
        return items.stream()
            .filter(item -> item.getItemOrder() > current.getItemOrder())
            .findFirst()
            .orElse(null);
    }

    private record DirectorPayload(
        String action,
        List<Long> candidatePersonaIds,
        String reply,
        String focus
    ) {
    }

    public record DirectorDecision(
        String action,
        DiscussionGuideItemRecord targetItem,
        List<Long> candidatePersonaIds,
        String reply,
        String focus,
        String displayContent,
        GenerationLocale generationLocale,
        AiLanguageValidationOutcome languageValidationOutcome
    ) {
        public DirectorDecision {
            candidatePersonaIds = candidatePersonaIds == null
                ? List.of()
                : List.copyOf(new ArrayList<>(candidatePersonaIds));
        }
    }
}
