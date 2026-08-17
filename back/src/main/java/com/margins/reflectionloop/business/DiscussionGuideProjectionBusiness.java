package com.margins.reflectionloop.business;

import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideMarkdownExportResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideProjectionResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionGuideResponse;
import com.margins.reflectionloop.model.dto.response.DiscussionQuestionDto;
import com.margins.reflectionloop.model.dto.response.FacilitatorDiscussionGuideProjectionResponse;
import com.margins.reflectionloop.model.dto.response.FacilitatorDiscussionQuestionDto;
import com.margins.reflectionloop.model.dto.response.ParticipantDiscussionGuideProjectionResponse;
import com.margins.reflectionloop.model.dto.response.ParticipantDiscussionQuestionDto;
import com.margins.reflectionloop.model.enums.DiscussionGuideProjection;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.model.ReadingSessionRecord;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DiscussionGuideProjectionBusiness {
    private static final String PRIVATE_ANSWER_LABEL = "비공개 인터뷰 답변";

    private final DiscussionGuideBusiness guideBusiness;
    private final ReadingSessionMapper readingSessionMapper;

    public DiscussionGuideProjectionResponse projection(Long guideId, String requestedProjection) {
        DiscussionGuideProjection projection = projectionType(requestedProjection);
        DiscussionGuideResponse guide = guideBusiness.get(guideId);
        ReadingSessionRecord session = readingSessionMapper.findByIdAndUserId(
            guide.getSessionId(),
            AuthContext.requireUserId()
        );
        if (session == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Reading session not found");
        }
        return switch (projection) {
            case FACILITATOR -> facilitator(guide, session);
            case PARTICIPANT -> participant(guide, session);
        };
    }

    public DiscussionGuideMarkdownExportResponse markdown(
        Long guideId,
        String requestedProjection
    ) {
        DiscussionGuideProjectionResponse response = projection(guideId, requestedProjection);
        if (response instanceof FacilitatorDiscussionGuideProjectionResponse facilitator) {
            return export(
                facilitator.getProjection(),
                facilitator.getGuideId(),
                facilitator.getGuideVersion(),
                facilitator.getBookTitle(),
                renderFacilitator(facilitator)
            );
        }
        ParticipantDiscussionGuideProjectionResponse participant =
            (ParticipantDiscussionGuideProjectionResponse) response;
        return export(
            participant.getProjection(),
            participant.getGuideId(),
            participant.getGuideVersion(),
            participant.getBookTitle(),
            renderParticipant(participant)
        );
    }

    private FacilitatorDiscussionGuideProjectionResponse facilitator(
        DiscussionGuideResponse guide,
        ReadingSessionRecord session
    ) {
        return FacilitatorDiscussionGuideProjectionResponse.builder()
            .projection(DiscussionGuideProjection.FACILITATOR)
            .guideId(guide.getGuideId())
            .guideVersion(guide.getGuideVersion())
            .current(guide.isCurrent())
            .bookTitle(session.getBookTitle())
            .bookAuthor(session.getBookAuthor())
            .goal(guide.getGoal())
            .issues(guide.getIssues())
            .targetMinutes(guide.getTargetMinutes())
            .items(guide.getItems().stream().map(this::facilitatorItem).toList())
            .build();
    }

    private ParticipantDiscussionGuideProjectionResponse participant(
        DiscussionGuideResponse guide,
        ReadingSessionRecord session
    ) {
        return ParticipantDiscussionGuideProjectionResponse.builder()
            .projection(DiscussionGuideProjection.PARTICIPANT)
            .guideId(guide.getGuideId())
            .guideVersion(guide.getGuideVersion())
            .current(guide.isCurrent())
            .bookTitle(session.getBookTitle())
            .bookAuthor(session.getBookAuthor())
            .goal(guide.getGoal())
            .issues(guide.getIssues())
            .items(guide.getItems().stream().map(this::participantItem).toList())
            .build();
    }

    private FacilitatorDiscussionQuestionDto facilitatorItem(DiscussionQuestionDto item) {
        boolean privateSource = item.isPrivateSource() || "ANSWER".equals(item.getSourceType());
        return FacilitatorDiscussionQuestionDto.builder()
            .stage(item.getStage())
            .priority(item.getPriority())
            .order(item.getOrder())
            .question(item.getQuestion())
            .intent(item.getIntent())
            .sourceType(item.getSourceType())
            .sourceLabel(privateSource ? PRIVATE_ANSWER_LABEL : sourceLabel(item.getSourceType()))
            .sourceExcerpt(privateSource ? null : item.getSourceExcerpt())
            .sourceVersion(item.getSourceVersion())
            .sourceStale(item.isSourceStale())
            .sourceFallback(item.isSourceFallback())
            .privateSource(privateSource)
            .sensitivity(item.getSensitivity())
            .skippable(item.isSkippable())
            .expectedMinutes(item.getExpectedMinutes())
            .followUps(item.getFollowUps() == null ? List.of() : item.getFollowUps())
            .build();
    }

    private ParticipantDiscussionQuestionDto participantItem(DiscussionQuestionDto item) {
        return ParticipantDiscussionQuestionDto.builder()
            .stage(item.getStage())
            .priority(item.getPriority())
            .order(item.getOrder())
            .question(item.getQuestion())
            .build();
    }

    private DiscussionGuideMarkdownExportResponse export(
        DiscussionGuideProjection projection,
        Long guideId,
        Integer version,
        String bookTitle,
        String content
    ) {
        return DiscussionGuideMarkdownExportResponse.builder()
            .projection(projection)
            .guideId(guideId)
            .guideVersion(version)
            .filename(
                filenameSlug(bookTitle)
                    + "-v"
                    + version
                    + "-"
                    + projection.name().toLowerCase(Locale.ROOT)
                    + ".md"
            )
            .content(content)
            .build();
    }

    private String renderFacilitator(FacilitatorDiscussionGuideProjectionResponse guide) {
        StringBuilder markdown = header(guide.getBookTitle(), guide.getBookAuthor(), guide.getGuideVersion(), guide.isCurrent(), "진행자용");
        appendOverview(markdown, guide.getGoal(), guide.getIssues(), guide.getTargetMinutes());
        markdown.append("## 질문\n\n");
        for (FacilitatorDiscussionQuestionDto item : guide.getItems()) {
            markdown
                .append("### ")
                .append(item.getOrder())
                .append(". ")
                .append(stageLabel(item.getStage()))
                .append("\n\n")
                .append(escapeMarkdown(item.getQuestion()))
                .append("\n\n")
                .append("- 우선순위: ")
                .append(priorityLabel(item.getPriority()))
                .append("\n")
                .append("- 진행 의도: ")
                .append(escapeMarkdown(item.getIntent()))
                .append("\n")
                .append("- 예상 시간: ")
                .append(item.getExpectedMinutes())
                .append("분\n")
                .append("- 민감도: ")
                .append(sensitivityLabel(item.getSensitivity()))
                .append("\n")
                .append("- 건너뛰기: ")
                .append(item.isSkippable() ? "가능" : "필수 응답")
                .append("\n")
                .append("- 근거: ")
                .append(escapeMarkdown(item.getSourceLabel()))
                .append("\n");
            if (item.getSourceVersion() != null && !item.getSourceVersion().isBlank()) {
                markdown
                    .append("- 근거 version: ")
                    .append(escapeMarkdown(item.getSourceVersion()))
                    .append("\n")
                    .append("- 근거 상태: ")
                    .append(item.isSourceStale() ? "이전 분석" : "현재 분석")
                    .append(item.isSourceFallback() ? " · fallback" : "")
                    .append("\n");
            }
            markdown.append("\n");
            if (item.isPrivateSource()) {
                markdown.append("> 비공개 답변 원문은 이 문서에 포함되지 않습니다.\n\n");
            } else if (item.getSourceExcerpt() != null && !item.getSourceExcerpt().isBlank()) {
                markdown
                    .append("> ")
                    .append(escapeMarkdown(item.getSourceExcerpt()))
                    .append("\n\n");
            }
            if (!item.getFollowUps().isEmpty()) {
                markdown.append("#### 후속 질문\n\n");
                for (String followUp : item.getFollowUps()) {
                    markdown.append("- ").append(escapeMarkdown(followUp)).append("\n");
                }
                markdown.append("\n");
            }
        }
        return markdown.toString();
    }

    private String renderParticipant(ParticipantDiscussionGuideProjectionResponse guide) {
        StringBuilder markdown = header(guide.getBookTitle(), guide.getBookAuthor(), guide.getGuideVersion(), guide.isCurrent(), "참여자용");
        markdown
            .append("## 오늘의 토론 목표\n\n")
            .append(escapeMarkdown(guide.getGoal()))
            .append("\n\n")
            .append("## 핵심 쟁점\n\n");
        for (String issue : guide.getIssues()) {
            markdown.append("- ").append(escapeMarkdown(issue)).append("\n");
        }
        markdown.append("\n");
        markdown.append("## 함께 나눌 질문\n\n");
        for (ParticipantDiscussionQuestionDto item : guide.getItems()) {
            markdown
                .append("### ")
                .append(item.getOrder())
                .append(". ")
                .append(stageLabel(item.getStage()))
                .append(" · ")
                .append(priorityLabel(item.getPriority()))
                .append("\n\n")
                .append(escapeMarkdown(item.getQuestion()))
                .append("\n\n");
        }
        return markdown.toString();
    }

    private StringBuilder header(
        String bookTitle,
        String bookAuthor,
        Integer version,
        boolean current,
        String projection
    ) {
        return new StringBuilder()
            .append("# 《")
            .append(escapeMarkdown(valueOrFallback(bookTitle, "책 제목 미상")))
            .append("》 독서 토론 발제문\n\n")
            .append("- 저자: ")
            .append(escapeMarkdown(valueOrFallback(bookAuthor, "저자 미상")))
            .append("\n")
            .append("- Version: v")
            .append(version)
            .append(current ? " · 현재" : " · 보관")
            .append("\n")
            .append("- 문서: ")
            .append(projection)
            .append("\n\n");
    }

    private void appendOverview(
        StringBuilder markdown,
        String goal,
        List<String> issues,
        Integer targetMinutes
    ) {
        markdown
            .append("## 오늘의 토론 목표\n\n")
            .append(escapeMarkdown(goal))
            .append("\n\n")
            .append("- 목표 시간: ")
            .append(targetMinutes)
            .append("분\n\n")
            .append("## 핵심 쟁점\n\n");
        for (String issue : issues) {
            markdown.append("- ").append(escapeMarkdown(issue)).append("\n");
        }
        markdown.append("\n");
    }

    private DiscussionGuideProjection projectionType(String value) {
        try {
            return DiscussionGuideProjection.valueOf(
                value == null ? "" : value.trim().toUpperCase(Locale.ROOT)
            );
        } catch (IllegalArgumentException exception) {
            throw new ApiException(
                ApiErrorCode.COMMON_BAD_REQUEST,
                "Discussion guide projection is invalid"
            );
        }
    }

    private String sourceLabel(String sourceType) {
        return switch (sourceType == null ? "" : sourceType) {
            case "REFLECTION" -> "현재 Reflection";
            case "HIGHLIGHT" -> "Highlight";
            case "BOOK_KNOWLEDGE" -> "Book Knowledge";
            default -> "연결된 근거";
        };
    }

    private String stageLabel(String stage) {
        return switch (stage == null ? "" : stage) {
            case "WARM_UP" -> "가볍게 시작하기";
            case "INTERPRETATION" -> "본문 해석하기";
            case "EXPERIENCE" -> "경험과 의미 연결하기";
            case "SOCIAL_VALUE" -> "사회와 가치로 넓히기";
            case "CLOSING" -> "생각 정리하기";
            default -> valueOrFallback(stage, "질문");
        };
    }

    private String priorityLabel(String priority) {
        return "OPTIONAL".equals(priority) ? "선택" : "필수";
    }

    private String sensitivityLabel(String sensitivity) {
        return switch (sensitivity == null ? "" : sensitivity) {
            case "HIGH" -> "높음";
            case "MEDIUM" -> "보통";
            default -> "낮음";
        };
    }

    private String escapeMarkdown(String value) {
        String safe = valueOrFallback(value, "").replaceAll("\\s+", " ").trim();
        return safe
            .replace("\\", "\\\\")
            .replace("`", "\\`")
            .replace("*", "\\*")
            .replace("_", "\\_")
            .replace("[", "\\[")
            .replace("]", "\\]")
            .replace("<", "\\<")
            .replace(">", "\\>")
            .replace("#", "\\#")
            .replace("|", "\\|");
    }

    private String filenameSlug(String value) {
        String slug = Normalizer.normalize(valueOrFallback(value, "discussion-guide"), Normalizer.Form.NFKC)
            .trim()
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{L}\\p{N}]+", "-")
            .replaceAll("(^-|-$)", "");
        if (slug.isBlank()) {
            return "discussion-guide";
        }
        return slug.length() <= 80 ? slug : slug.substring(0, 80).replaceAll("-$", "");
    }

    private String valueOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
