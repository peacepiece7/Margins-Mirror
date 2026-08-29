package com.margins.moderation.business;

import com.margins.auth.support.AuthContext;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.ai.observability.AiTraceContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.moderation.DiscussionModerationRequest;
import com.margins.moderation.DiscussionModerationResult;
import com.margins.moderation.DiscussionModerator;
import com.margins.moderation.ModerationDecision;
import com.margins.moderation.ModerationProperties;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.dto.ModerationFeedbackRequest;
import com.margins.moderation.mapper.ModerationEventMapper;
import com.margins.moderation.model.ModerationEventRecord;
import com.margins.session.model.SessionWindowContext;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
/** Moderator 실행, 판정 event/aggregate 저장, owner-only 피드백 규칙을 조율한다. */
public class ModerationBusiness {
    private final ModerationProperties properties;
    private final DiscussionModerator discussionModerator;
    private final ModerationEventMapper moderationEventMapper;
    private GenerationLocaleResolver generationLocaleResolver;
    private AiOutputLanguageValidator languageValidator = new AiOutputLanguageValidator();
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    @Autowired
    public void configureGenerationLocale(
        GenerationLocaleResolver generationLocaleResolver,
        AiOutputLanguageValidator languageValidator
    ) {
        this.generationLocaleResolver = generationLocaleResolver;
        this.languageValidator = languageValidator;
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public ModerationEventRecord evaluate(SessionWindowContext context, String content) {
        return evaluate(context, content, null);
    }

    public ModerationEventRecord evaluate(
        SessionWindowContext context,
        String content,
        String depth
    ) {
        if (generationLocaleResolver == null) {
            throw new IllegalStateException("GenerationLocaleResolver is required");
        }
        return evaluate(
            context,
            content,
            depth,
            generationLocaleResolver.resolve(context.getUserId())
        );
    }

    public ModerationEventRecord evaluate(
        SessionWindowContext context,
        String content,
        String depth,
        GenerationLocale locale
    ) {
        String requestId = UUID.randomUUID().toString();
        AiGenerationTask task = new AiGenerationTask(
            "MODERATOR",
            properties.getPromptVersion(),
            properties.getSchemaVersion(),
            locale
        );
        AiGenerationResult<DiscussionModerationResult> generation;
        long startedAt = System.nanoTime();
        try {
            generation = discussionModerator.moderateWithMetadata(
                new DiscussionModerationRequest(requestId, context.getId(), content),
                task
            );
        } catch (RuntimeException exception) {
            generation = AiGenerationResult.failure(
                task,
                "unknown",
                "unknown",
                elapsedMillis(startedAt)
            );
        }
        DiscussionModerationResult result = generation == null ? null : generation.value();
        if (result == null) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Moderation result could not be generated"
            );
        }
        AiLanguageValidationOutcome validation = generation.fallbackUsed()
            && generation.languageValidationOutcome() == null
                ? null
                : result.getDecision() == ModerationDecision.REDIRECT
                    ? languageValidator.validate(locale, result.getSuggestedQuestion())
                    : AiLanguageValidationOutcome.UNKNOWN;
        if (validation == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
            result = result.toBuilder()
                .suggestedQuestion(locale == GenerationLocale.KO
                    ? "책의 주제로 돌아가 어떤 장면이 가장 기억에 남았는지 이야기해 볼까요?"
                    : "Returning to the book, which scene stayed with you most?")
                .fallbackUsed(true)
                .build();
            generation = generation.withValue(result, "FALLBACK", true, validation);
        } else {
            generation = generation.withLanguageValidation(validation);
        }
        generationObserver.observe(
            generation,
            depth,
            context.isTestData(),
            new AiTraceContext(context.getUserId(), context.getSessionId())
        );
        String decision = result.getDecision().name();
        ModerationEventRecord event = ModerationEventRecord.builder()
            .requestId(requestId)
            .userId(context.getUserId())
            .bookId(context.getBookId())
            .sessionId(context.getSessionId())
            .windowId(context.getId())
            .inputText(result.getDecision() == ModerationDecision.ALLOW ? null : content)
            .decision(decision)
            .intent(result.getIntent().name())
            .relevanceScore(result.getRelevanceScore())
            .confidence(result.getConfidence())
            .reasonCode(result.getReasonCode())
            .suggestedQuestion(blankToNull(result.getSuggestedQuestion()))
            .model(result.getModel())
            .policyVersion(properties.getPolicyVersion())
            .promptVersion(properties.getPromptVersion())
            .schemaVersion(properties.getSchemaVersion())
            .latencyMs(result.getLatencyMs())
            .fallbackUsed(result.isFallbackUsed())
            .routingOutcome(initialRoutingOutcome(result.getDecision()))
            .personaCalled(false)
            .providerErrorCode(result.getProviderErrorCode())
            .generationLocale(locale.value())
            .languageValidationOutcome(validation == null ? null : validation.name())
            .testData(context.isTestData())
            .build();
        requireChanged(moderationEventMapper.insert(event), "Moderation event could not be saved");
        requireChanged(
            moderationEventMapper.incrementEventAggregate(event),
            "Moderation aggregate could not be saved"
        );
        return requireOwnedEvent(event.getId(), context.getUserId());
    }

    public ModerationEventRecord finalizeAllowed(
        ModerationEventRecord event,
        Long messageId,
        boolean personaCalled
    ) {
        requireChanged(
            moderationEventMapper.updateRouting(
                event.getId(),
                messageId,
                personaCalled ? "PERSONA_CALLED" : "ALLOWED",
                personaCalled
            ),
            "Moderation routing could not be finalized"
        );
        if (personaCalled) {
            requireChanged(
                moderationEventMapper.incrementPersonaCalledAggregate(event),
                "Moderation aggregate could not be finalized"
            );
        }
        return requireOwnedEvent(event.getId(), event.getUserId());
    }

    public ModerationEventDto feedback(Long eventId, ModerationFeedbackRequest request) {
        long userId = AuthContext.requireUserId();
        ModerationEventRecord event = requireOwnedEvent(eventId, userId);
        int updated = moderationEventMapper.setFirstFeedback(
            eventId,
            userId,
            request.getFeedback().name()
        );
        if (updated == 0) {
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Moderation feedback already exists");
        }
        requireChanged(
            moderationEventMapper.incrementFeedbackAggregate(event, request.getFeedback().name()),
            "Moderation feedback aggregate could not be saved"
        );
        return toDto(requireOwnedEvent(eventId, userId));
    }

    public ModerationEventDto toDto(ModerationEventRecord event) {
        if (event == null) {
            return null;
        }
        return ModerationEventDto.builder()
            .eventId(event.getId())
            .sessionId(event.getSessionId())
            .windowId(event.getWindowId())
            .decision(event.getDecision())
            .intent(event.getIntent())
            .reasonCode(event.getReasonCode())
            .suggestedQuestion(event.getSuggestedQuestion())
            .fallbackUsed(event.isFallbackUsed())
            .routingOutcome(event.getRoutingOutcome())
            .personaCalled(event.isPersonaCalled())
            .userFeedback(event.getUserFeedback())
            .createdAt(event.getCreatedAt())
            .build();
    }

    private ModerationEventRecord requireOwnedEvent(Long eventId, Long userId) {
        ModerationEventRecord event = moderationEventMapper.findByIdAndUserId(eventId, userId);
        if (event == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Moderation event not found");
        }
        return event;
    }

    private String initialRoutingOutcome(ModerationDecision decision) {
        return switch (decision) {
            case ALLOW -> "PENDING";
            case REDIRECT -> "REDIRECTED";
            case REJECT -> "REJECTED";
        };
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(
            Integer.MAX_VALUE,
            Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L)
        );
    }

    private void requireChanged(int changed, String reason) {
        if (changed <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, reason);
        }
    }
}
