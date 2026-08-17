package com.margins.reflectionloop.ai;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiProvider;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiTokenUsage;
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

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    public DirectorDecision decide(
        Long windowId,
        DiscussionGuideItemRecord current,
        List<DiscussionGuideItemRecord> items,
        String content,
        String navigation
    ) {
        return decide(
            windowId,
            current,
            items,
            content,
            navigation,
            "discussion-director-v1",
            null,
            false,
            List.of()
        );
    }

    public DirectorDecision decide(
        Long windowId,
        DiscussionGuideItemRecord current,
        List<DiscussionGuideItemRecord> items,
        String content,
        String navigation,
        String promptVersion,
        String depth,
        boolean testData
    ) {
        return decide(
            windowId,
            current,
            items,
            content,
            navigation,
            promptVersion,
            depth,
            testData,
            List.of()
        );
    }

    public DirectorDecision decide(
        Long windowId,
        DiscussionGuideItemRecord current,
        List<DiscussionGuideItemRecord> items,
        String content,
        String navigation,
        String promptVersion,
        String depth,
        boolean testData,
        List<PersonaRecord> personas
    ) {
        if ("FINISH".equals(navigation)) {
            return new DirectorDecision("FINISH_DISCUSSION", null);
        }
        DiscussionGuideItemRecord next = next(items, current);
        if ("NEXT".equals(navigation)) {
            return new DirectorDecision(
                next == null ? "FINISH_DISCUSSION" : "MOVE_NEXT_TOPIC",
                next
            );
        }
        AiGenerationTask task = new AiGenerationTask(
            "DISCUSSION_DIRECTOR",
            promptVersion,
            "director-action-v1"
        );
        AiGenerationResult<AiMessageResponse> generation = null;
        try {
            SendMessageRequest request = SendMessageRequest.builder()
                    .questionId(current.getQuestionId())
                    .content(prompt(current, content, personas))
                    .build();
            generation = aiProvider.answerWindowMessageWithMetadata(windowId, request, task);
            if (generation == null) {
                generation = legacyGeneration(windowId, request, task);
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
                return safeFallback(current);
            }
            generationObserver.observe(generation, depth, testData);
            String action = parsed.action();
            if ("MOVE_NEXT_TOPIC".equals(action) && next == null) {
                return new DirectorDecision(
                    "SUMMARIZE_TOPIC",
                    current,
                    List.of(),
                    parsed.reply(),
                    parsed.focus()
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
                parsed.focus()
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
            return safeFallback(current);
        }
    }

    private AiGenerationResult<AiMessageResponse> legacyGeneration(
        Long windowId,
        SendMessageRequest request,
        AiGenerationTask task
    ) {
        long startedAt = System.nanoTime();
        try {
            AiMessageResponse response = aiProvider.answerWindowMessage(windowId, request);
            String model = response == null ? "unknown" : response.getAiModel();
            boolean fallbackUsed = "placeholder".equalsIgnoreCase(model);
            return AiGenerationResult.completed(
                response,
                task,
                fallbackUsed ? "placeholder" : "unknown",
                model,
                response == null ? AiTokenUsage.NONE : AiTokenUsage.fromJson(response.getTokenUsage()),
                elapsedMillis(startedAt),
                fallbackUsed ? "FALLBACK" : "SUCCESS",
                fallbackUsed
            );
        } catch (RuntimeException exception) {
            return AiGenerationResult.failure(task, "unknown", "unknown", elapsedMillis(startedAt));
        }
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }

    private DirectorDecision safeFallback(DiscussionGuideItemRecord current) {
        return new DirectorDecision("ASK_FOLLOW_UP", current);
    }

    private String prompt(
        DiscussionGuideItemRecord current,
        String content,
        List<PersonaRecord> personas
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
        String focus
    ) {
        public DirectorDecision(String action, DiscussionGuideItemRecord targetItem) {
            this(action, targetItem, List.of(), null, null);
        }

        public DirectorDecision {
            candidatePersonaIds = candidatePersonaIds == null
                ? List.of()
                : List.copyOf(new ArrayList<>(candidatePersonaIds));
        }
    }
}
