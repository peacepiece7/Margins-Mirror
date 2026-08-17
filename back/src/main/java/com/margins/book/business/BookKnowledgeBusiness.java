package com.margins.book.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiProvider;
import com.margins.auth.support.AuthContext;
import com.margins.book.BookKnowledgeProperties;
import com.margins.book.dto.BookKnowledgeAnalyzeRequest;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.mapper.BookKnowledgeMapper;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.book.model.BookKnowledgeStatus;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BookKnowledgeBusiness {
    public static final String PROMPT_VERSION = "book-knowledge-v1";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<List<BookKnowledgeDto.DiscussionPointDto>> DISCUSSION_POINTS =
        new TypeReference<>() {};
    private static final TypeReference<List<BookKnowledgeDto.RecommendedPersonaDto>> RECOMMENDED_PERSONAS =
        new TypeReference<>() {};
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final BookKnowledgeMapper bookKnowledgeMapper;
    private final BookMapper bookMapper;
    private final AiProvider aiProvider;
    private final BookKnowledgeProperties properties;
    private AiGenerationObserver generationObserver = AiGenerationObserver.NO_OP;

    @Autowired
    void configureGenerationObserver(AiGenerationObserver generationObserver) {
        this.generationObserver = generationObserver;
    }

    public void ensureForBook(Long bookId) {
        ensureForBook(bookId, AuthContext.requireUserId());
    }

    public void ensureForBook(Long bookId, Long userId) {
        BookRecord book = findOwnedBook(bookId, userId);
        ensureKnowledge(book);
    }

    public BookKnowledgeDto findForBook(Long bookId) {
        ResolvedKnowledge resolved = findReusableForBook(findOwnedBook(bookId));
        if (resolved == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book Knowledge was not found");
        }
        return toDto(resolved);
    }

    public BookKnowledgeDto regenerate(Long bookId) {
        return toDto(refresh(findOwnedBook(bookId)));
    }

    public ResolvedKnowledge ensureKnowledge(BookRecord book) {
        ResolvedKnowledge existing = findReusableForBook(book);
        if (isFreshProviderResult(existing)) {
            return existing;
        }
        return refresh(book);
    }

    /**
     * Read-only resolution for Reflection evidence and other prompt builders.
     */
    public ResolvedKnowledge findReusableForBook(BookRecord book) {
        Identity identity = identity(book);
        BookKnowledgeRecord current = bookKnowledgeMapper.findByIdentityAndPromptVersion(
            identity.type(),
            identity.key(),
            PROMPT_VERSION
        );
        boolean refreshPending = hasActiveClaim(current);
        if (current != null
            && BookKnowledgeStatus.READY.equals(current.getStatus())
            && validFallback(current) != null) {
            return new ResolvedKnowledge(
                current,
                isStale(current),
                current.isFallbackUsed(),
                refreshPending
            );
        }

        BookKnowledgeRecord fallback = validFallback(
            bookKnowledgeMapper.findLatestReadyByIdentity(identity.type(), identity.key())
        );
        if (fallback != null) {
            return new ResolvedKnowledge(fallback, true, true, refreshPending);
        }
        if (current == null || BookKnowledgeStatus.READY.equals(current.getStatus())) {
            return null;
        }
        return new ResolvedKnowledge(
            current,
            true,
            current.isFallbackUsed(),
            refreshPending
        );
    }

    private ResolvedKnowledge refresh(BookRecord book) {
        Identity identity = identity(book);
        String claimToken = UUID.randomUUID().toString();
        log.info(
            "Book Knowledge refresh started. identityType={}, outcome=STARTED",
            identity.type()
        );
        BookKnowledgeRecord claimed = claim(book, identity, claimToken);
        if (claimed == null) {
            ResolvedKnowledge concurrent = findReusableForBook(book);
            log.info(
                "Book Knowledge claim not acquired. outcome=ALREADY_IN_PROGRESS, resolved={}, identityType={}",
                concurrent != null,
                identity.type()
            );
            if (concurrent != null) {
                return concurrent.withRefreshPending(true);
            }
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Book Knowledge generation is already in progress"
            );
        }

        AiGenerationResult<BookKnowledgeDto> generation;
        try {
            generation = aiProvider.analyzeBookKnowledgeWithMetadata(analyzeRequest(book));
        } catch (RuntimeException exception) {
            generation = null;
            log.warn(
                "Book Knowledge generation failed before metadata. identityType={}, error={}",
                identity.type(),
                exception.getClass().getSimpleName()
            );
        }
        log.info(
            "Book Knowledge AI generation returned. outcome={}, received={}, fallbackUsed={}",
            generation == null ? "FAILURE" : generation.outcome(),
            generation != null,
            generation != null && generation.fallbackUsed()
        );
        if (generation != null) {
            generationObserver.observe(generation, null, book.isTestData());
        }

        if (properties.isRequireProvider()
            && (generation == null
                || generation.value() == null
                || "FAILURE".equalsIgnoreCase(generation.outcome()))) {
            return failAndResolve(
                book,
                claimed,
                claimToken,
                new ApiException(
                    ApiErrorCode.COMMON_UPSTREAM_ERROR,
                    "Book Knowledge provider is unavailable"
                )
            );
        }

        BookKnowledgeDto analyzed = generation == null ? null : generation.value();
        try {
            validate(analyzed);
        } catch (RuntimeException exception) {
            return failAndResolve(book, claimed, claimToken, exception);
        }

        BookKnowledgeRecord previous = validFallback(
            bookKnowledgeMapper.findLatestReadyByIdentity(identity.type(), identity.key())
        );
        if (properties.isRequireProvider() && generation.fallbackUsed()) {
            return failAndResolve(
                book,
                claimed,
                claimToken,
                new ApiException(
                    ApiErrorCode.COMMON_UPSTREAM_ERROR,
                    "Book Knowledge provider is unavailable"
                )
            );
        }
        if (generation.fallbackUsed()
            && previous != null
            && !previous.getId().equals(claimed.getId())
            && !previous.isFallbackUsed()) {
            return failAndResolve(
                book,
                claimed,
                claimToken,
                new IllegalStateException("Analyzer fallback kept previous ready knowledge")
            );
        }
        if (generation.fallbackUsed()
            && previous != null
            && previous.getId().equals(claimed.getId())
            && !previous.isFallbackUsed()) {
            return failAndResolve(
                book,
                claimed,
                claimToken,
                new IllegalStateException("Analyzer fallback kept current ready knowledge")
            );
        }

        BookKnowledgeRecord completed = recordFrom(
            book,
            analyzed,
            BookKnowledgeStatus.READY,
            null,
            generation.fallbackUsed(),
            claimToken
        );
        completed.setId(claimed.getId());
        if (bookKnowledgeMapper.completeGeneration(completed) <= 0) {
            log.warn("Book Knowledge completion rejected. outcome=CLAIM_CHANGED");
            ResolvedKnowledge concurrent = findReusableForBook(book);
            if (concurrent != null) {
                return concurrent;
            }
            throw new ApiException(
                ApiErrorCode.COMMON_CONFLICT,
                "Book Knowledge claim changed before completion"
            );
        }
        log.info(
            "Book Knowledge generation completed. outcome=SUCCESS, fallbackUsed={}",
            generation.fallbackUsed()
        );
        return new ResolvedKnowledge(completed, false, generation.fallbackUsed(), false);
    }

    private BookKnowledgeRecord claim(
        BookRecord book,
        Identity identity,
        String claimToken
    ) {
        BookKnowledgeRecord current = bookKnowledgeMapper.findByIdentityAndPromptVersion(
            identity.type(),
            identity.key(),
            PROMPT_VERSION
        );
        if (current != null) {
            boolean acquired = bookKnowledgeMapper.claimGeneration(
                current.getId(),
                claimToken,
                validClaimTtlSeconds()
            ) > 0;
            log.info(
                "Book Knowledge claim attempted. outcome={}, rowState={}",
                acquired ? "ACQUIRED" : "ALREADY_IN_PROGRESS",
                current.getStatus()
            );
            return acquired ? withClaim(current, claimToken) : null;
        }

        BookKnowledgeRecord pending = recordFrom(
            book,
            null,
            BookKnowledgeStatus.PENDING,
            null,
            false,
            claimToken
        );
        try {
            bookKnowledgeMapper.insert(pending);
            log.info("Book Knowledge claim created. outcome=ACQUIRED, rowState=PENDING");
            return pending;
        } catch (DuplicateKeyException duplicate) {
            BookKnowledgeRecord raced = bookKnowledgeMapper.findByIdentityAndPromptVersion(
                identity.type(),
                identity.key(),
                PROMPT_VERSION
            );
            boolean acquired = raced != null && bookKnowledgeMapper.claimGeneration(
                raced.getId(),
                claimToken,
                validClaimTtlSeconds()
            ) > 0;
            log.info(
                "Book Knowledge claim insert raced. outcome={}",
                acquired ? "ACQUIRED" : "ALREADY_IN_PROGRESS"
            );
            return acquired ? withClaim(raced, claimToken) : null;
        }
    }

    private ResolvedKnowledge failAndResolve(
        BookRecord book,
        BookKnowledgeRecord claimed,
        String claimToken,
        RuntimeException exception
    ) {
        log.warn(
            "Book Knowledge generation failed. outcome=FAILURE, errorType={}",
            exception.getClass().getSimpleName()
        );
        bookKnowledgeMapper.failGeneration(
            claimed.getId(),
            claimToken,
            summarize(exception)
        );
        ResolvedKnowledge fallback = findReusableForBook(book);
        if (fallback != null) {
            return fallback.withFallback(true);
        }
        if (exception instanceof ApiException apiException) {
            throw apiException;
        }
        throw new ApiException(
            ApiErrorCode.COMMON_INTERNAL_ERROR,
            "Book Knowledge generation failed"
        );
    }

    private BookKnowledgeAnalyzeRequest analyzeRequest(BookRecord book) {
        return BookKnowledgeAnalyzeRequest.builder()
            .title(book.getTitle())
            .author(book.getAuthor())
            .isbn(normalizeIsbn(book.getIsbn()))
            .publishedYear(book.getPublishedYear())
            .description(book.getDescription())
            .language(book.getLanguageCode())
            .promptVersion(PROMPT_VERSION)
            .build();
    }

    private boolean isFreshProviderResult(ResolvedKnowledge resolved) {
        return resolved != null
            && BookKnowledgeStatus.READY.equals(resolved.record().getStatus())
            && !resolved.stale()
            && !resolved.fallbackUsed()
            && !resolved.refreshPending();
    }

    private boolean isStale(BookKnowledgeRecord record) {
        return record.getGeneratedAt() == null
            || record.getGeneratedAt().isBefore(now().minusDays(validFreshDays()));
    }

    private BookKnowledgeRecord validFallback(BookKnowledgeRecord record) {
        if (record == null
            || record.getGeneratedAt() == null
            || record.getGeneratedAt().isBefore(now().minusDays(validFallbackDays()))) {
            return null;
        }
        return record;
    }

    private boolean hasActiveClaim(BookKnowledgeRecord record) {
        return record != null
            && record.getId() != null
            && record.getGenerationClaimToken() != null
            && !record.getGenerationClaimToken().isBlank()
            && bookKnowledgeMapper.hasActiveGenerationClaim(
                record.getId(),
                validClaimTtlSeconds()
            );
    }

    private BookKnowledgeRecord withClaim(BookKnowledgeRecord record, String claimToken) {
        record.setGenerationClaimToken(claimToken);
        record.setGenerationClaimedAt(now());
        if (!BookKnowledgeStatus.READY.equals(record.getStatus())) {
            record.setStatus(BookKnowledgeStatus.PENDING);
        }
        return record;
    }

    private BookRecord findOwnedBook(Long bookId) {
        return findOwnedBook(bookId, AuthContext.requireUserId());
    }

    private BookRecord findOwnedBook(Long bookId, Long userId) {
        BookRecord book = bookMapper.findByIdForUser(bookId, userId);
        if (book == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book was not found");
        }
        return book;
    }

    private BookKnowledgeRecord recordFrom(
        BookRecord book,
        BookKnowledgeDto dto,
        String status,
        String failureReason,
        boolean fallbackUsed,
        String claimToken
    ) {
        Identity identity = identity(book);
        return BookKnowledgeRecord.builder()
            .isbn(normalizeIsbn(book.getIsbn()))
            .titleNormalized(normalizeIdentity(book.getTitle()))
            .authorNormalized(normalizeIdentity(book.getAuthor()))
            .lookupKeyType(identity.type())
            .lookupKey(identity.key())
            .title(book.getTitle())
            .author(book.getAuthor())
            .summary(dto == null ? null : dto.getSummary())
            .themesJson(writeJson(dto == null ? List.of() : dto.getThemes()))
            .discussionPointsJson(writeJson(dto == null ? List.of() : dto.getDiscussionPoints()))
            .recommendedPersonasJson(writeJson(dto == null ? List.of() : dto.getRecommendedPersonas()))
            .famousQuotesJson(writeJson(dto == null ? List.of() : dto.getFamousQuotes()))
            .keywordsJson(writeJson(dto == null ? List.of() : dto.getKeywords()))
            .promptVersion(PROMPT_VERSION)
            .status(status)
            .fallbackUsed(fallbackUsed)
            .testData(book.isTestData())
            .failureReason(failureReason)
            .generationClaimToken(claimToken)
            .generationClaimedAt(claimToken == null ? null : now())
            .generatedAt(BookKnowledgeStatus.READY.equals(status) ? now() : null)
            .build();
    }

    private Identity identity(BookRecord book) {
        String normalizedIsbn = normalizeIsbn(book.getIsbn());
        if (normalizedIsbn != null) {
            return new Identity("isbn", normalizedIsbn);
        }
        return new Identity(
            "title_author",
            normalizeIdentity(book.getTitle()) + "|" + normalizeIdentity(book.getAuthor())
        );
    }

    private void validate(BookKnowledgeDto dto) {
        if (dto == null
            || blank(dto.getSummary())
            || dto.getDiscussionPoints() == null
            || dto.getDiscussionPoints().isEmpty()) {
            throw new IllegalArgumentException("Book Analyzer result is invalid");
        }
    }

    private BookKnowledgeDto toDto(ResolvedKnowledge resolved) {
        BookKnowledgeRecord record = resolved.record();
        return BookKnowledgeDto.builder()
            .knowledgeId(record.getId())
            .isbn(record.getIsbn())
            .title(record.getTitle())
            .author(record.getAuthor())
            .summary(record.getSummary())
            .themes(readJson(record.getThemesJson(), STRING_LIST, List.of()))
            .discussionPoints(readJson(record.getDiscussionPointsJson(), DISCUSSION_POINTS, List.of()))
            .recommendedPersonas(readJson(
                record.getRecommendedPersonasJson(),
                RECOMMENDED_PERSONAS,
                List.of()
            ))
            .famousQuotes(readJson(record.getFamousQuotesJson(), STRING_LIST, List.of()))
            .keywords(readJson(record.getKeywordsJson(), STRING_LIST, List.of()))
            .version(record.getPromptVersion())
            .status(record.getStatus())
            .generatedAt(
                record.getGeneratedAt() == null
                    ? null
                    : record.getGeneratedAt().format(FORMATTER)
            )
            .stale(resolved.stale())
            .fallbackUsed(resolved.fallbackUsed() || record.isFallbackUsed())
            .refreshPending(resolved.refreshPending())
            .build();
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Book Knowledge JSON could not be written", exception);
        }
    }

    private <T> T readJson(String json, TypeReference<T> type, T fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return OBJECT_MAPPER.readValue(json, type);
        } catch (JsonProcessingException exception) {
            return fallback;
        }
    }

    public static String normalizeIsbn(String isbn) {
        if (isbn == null) {
            return null;
        }
        String normalized = isbn.replaceAll("[^0-9Xx]", "").toUpperCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    public static String normalizeIdentity(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
    }

    private int validFreshDays() {
        return Math.max(1, properties.getFreshDays());
    }

    private int validFallbackDays() {
        return Math.max(validFreshDays(), properties.getFallbackDays());
    }

    private int validClaimTtlSeconds() {
        return Math.max(30, properties.getClaimTtlSeconds());
    }

    private LocalDateTime now() {
        return LocalDateTime.now();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String summarize(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.length() <= 500 ? message : message.substring(0, 500);
    }

    private record Identity(String type, String key) {
    }

    public record ResolvedKnowledge(
        BookKnowledgeRecord record,
        boolean stale,
        boolean fallbackUsed,
        boolean refreshPending
    ) {
        public ResolvedKnowledge withRefreshPending(boolean pending) {
            return new ResolvedKnowledge(record, stale, fallbackUsed, pending);
        }

        public ResolvedKnowledge withFallback(boolean fallback) {
            return new ResolvedKnowledge(record, stale, fallback, refreshPending);
        }
    }
}
