package com.margins.reflectionloop.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.business.BookKnowledgeBusiness.ResolvedKnowledge;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.session.mapper.ReadingSessionMapper;
import com.margins.session.mapper.SessionHighlightMapper;
import com.margins.session.model.ReadingSessionRecord;
import com.margins.session.model.SessionHighlightRecord;
import com.margins.session.model.SessionInsightRecord;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReflectionEvidenceCatalog {
    public static final int MAX_ANSWERS = 7;
    public static final int MAX_HIGHLIGHTS = 3;
    public static final int MAX_BOOK_KNOWLEDGE = 1;
    public static final int MAX_GUIDE_EXCERPT = 500;

    private final ReflectionInterviewMapper interviewMapper;
    private final ReadingSessionMapper readingSessionMapper;
    private final SessionHighlightMapper highlightMapper;
    private final BookMapper bookMapper;
    private final BookKnowledgeBusiness bookKnowledgeBusiness;

    public EvidenceCatalog load(
        ReflectionInterviewRecord interview,
        ReflectionRevisionRecord revision,
        boolean includePrivateAnswers
    ) {
        long userId = AuthContext.requireUserId();
        ReadingSessionRecord session = readingSessionMapper.findByIdAndUserId(
            interview.getSessionId(),
            userId
        );
        if (session == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Evidence session not found");
        }
        BookRecord book = bookMapper.findByIdForUser(session.getBookId(), userId);
        if (book == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Evidence book not found");
        }

        Source reflection = new Source(
            "R1",
            "REFLECTION",
            revision.getId(),
            truncate(revision.getContent(), MAX_GUIDE_EXCERPT),
            null,
            false,
            false
        );
        List<Source> answers = includePrivateAnswers
            ? answerSources(interview, userId)
            : List.of();
        List<Source> highlights = highlightSources(interview, userId);
        Source bookKnowledge = bookKnowledgeSource(book);
        return new EvidenceCatalog(
            reflection,
            answers,
            highlights,
            bookKnowledge == null ? List.of() : List.of(bookKnowledge)
        );
    }

    private List<Source> answerSources(ReflectionInterviewRecord interview, long userId) {
        List<Source> sources = new ArrayList<>();
        List<QuestionRecord> answered = interviewMapper.findAnsweredInterviewQuestions(
            interview.getId(),
            userId
        );
        for (QuestionRecord question : answered) {
            if (sources.size() >= MAX_ANSWERS) {
                break;
            }
            SessionInsightRecord answer = interviewMapper.findQuestionAnswerInsight(
                question.getId(),
                userId
            );
            if (answer != null && !blank(answer.getContent())) {
                sources.add(new Source(
                    "A" + (sources.size() + 1),
                    "ANSWER",
                    answer.getId(),
                    truncate(answer.getContent(), MAX_GUIDE_EXCERPT),
                    null,
                    false,
                    false
                ));
            }
        }
        return List.copyOf(sources);
    }

    private List<Source> highlightSources(ReflectionInterviewRecord interview, long userId) {
        List<SessionHighlightRecord> highlights = highlightMapper.findBoundedOwnedBySession(
            interview.getSessionId(),
            userId,
            MAX_HIGHLIGHTS
        );
        List<Source> sources = new ArrayList<>();
        for (SessionHighlightRecord highlight : highlights) {
            if (highlight.getId() == null
                || !interview.getSessionId().equals(highlight.getSessionId())) {
                continue;
            }
            String excerpt = highlightExcerpt(highlight);
            if (excerpt.isBlank()) {
                continue;
            }
            sources.add(new Source(
                "H" + (sources.size() + 1),
                "HIGHLIGHT",
                highlight.getId(),
                excerpt,
                null,
                false,
                false
            ));
        }
        return List.copyOf(sources);
    }

    private Source bookKnowledgeSource(BookRecord book) {
        ResolvedKnowledge resolved = bookKnowledgeBusiness.findReusableForBook(book);
        if (resolved == null
            || resolved.record() == null
            || blank(resolved.record().getSummary())) {
            return null;
        }
        BookKnowledgeRecord record = resolved.record();
        return new Source(
            "BK1",
            "BOOK_KNOWLEDGE",
            record.getId(),
            truncate(record.getSummary(), MAX_GUIDE_EXCERPT),
            record.getPromptVersion(),
            resolved.stale(),
            resolved.fallbackUsed() || record.isFallbackUsed()
        );
    }

    private String highlightExcerpt(SessionHighlightRecord highlight) {
        List<String> parts = new ArrayList<>();
        if (!blank(highlight.getQuoteText())) {
            parts.add(highlight.getQuoteText().trim());
        }
        if (!blank(highlight.getNote())) {
            parts.add("메모: " + highlight.getNote().trim());
        }
        return truncate(String.join(" | ", parts), MAX_GUIDE_EXCERPT);
    }

    private String truncate(String value, int max) {
        String safe = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public record EvidenceCatalog(
        Source reflection,
        List<Source> answers,
        List<Source> highlights,
        List<Source> bookKnowledge
    ) {
        public List<Source> all() {
            List<Source> all = new ArrayList<>();
            all.add(reflection);
            all.addAll(answers);
            all.addAll(highlights);
            all.addAll(bookKnowledge);
            return List.copyOf(all);
        }

        public Source latestAnswer() {
            return answers.isEmpty() ? null : answers.get(answers.size() - 1);
        }

        public Source firstHighlight() {
            return highlights.isEmpty() ? null : highlights.get(0);
        }

        public Source firstBookKnowledge() {
            return bookKnowledge.isEmpty() ? null : bookKnowledge.get(0);
        }

        public Source primaryFor(String coverageArea, boolean bookOnly) {
            if (bookOnly) {
                return firstNonNull(firstHighlight(), firstBookKnowledge(), reflection);
            }
            return switch (coverageArea) {
                case "TEXTUAL_INTERPRETATION" ->
                    firstNonNull(firstHighlight(), latestAnswer(), reflection);
                case "SOCIAL_VALUE" ->
                    firstNonNull(firstBookKnowledge(), firstHighlight(), latestAnswer(), reflection);
                default -> firstNonNull(latestAnswer(), reflection);
            };
        }

        private Source firstNonNull(Source... sources) {
            for (Source source : sources) {
                if (source != null) {
                    return source;
                }
            }
            return reflection;
        }
    }

    public record Source(
        String alias,
        String type,
        Long refId,
        String excerpt,
        String version,
        boolean stale,
        boolean fallback
    ) {
    }
}
