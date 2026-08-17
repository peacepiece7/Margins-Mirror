package com.margins.book.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.auth.support.AuthContext;
import com.margins.book.dto.*;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookReadingStatus;
import com.margins.book.model.BookRecord;
import com.margins.book.model.BookShelfSort;
import com.margins.book.provider.BookSearchProperties;
import com.margins.book.provider.BookSearchProvider;
import com.margins.book.provider.BookSearchResult;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * 책 도메인의 핵심 업무 규칙을 처리한다.
 * 외부 검색 후보 병합, 책 저장, 서재 목록/상태 변경, 삭제 흐름을 조율한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookBusiness {

    private static final int SAVE_TEXT_LIMIT = 255;
    private static final int ISBN_TEXT_LIMIT = 32;
    private static final int LANGUAGE_TEXT_LIMIT = 16;
    private static final int URL_TEXT_LIMIT = 1000;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final List<BookSearchProvider> bookSearchProviders;
    private final BookSearchProperties bookSearchProperties;
    private final BookMapper bookMapper;

    /**
     * 설정된 우선순위로 external provider를 검색하고, 모두 비어 있으면 빈 결과를 반환한다.
     */
    public BookCandidateSearchResponse searchCandidates(BookCandidateSearchRequest request) {
        int page = Objects.requireNonNullElse(request.getPage(), bookSearchProperties.getPage());
        int limit = Objects.requireNonNullElse(request.getLimit(), bookSearchProperties.getLimit());

        for (var provider : orderedProviders()) {
            BookSearchResult providerResult = provider.search(request.getQuery(), page, limit);
            List<BookCandidateDto> candidates = providerResult.getCandidates();

            if (candidates.isEmpty()) {
                if (page > 1 && providerResult.getTotalItems() != null) {
                    return searchResponse(candidates, page, limit, providerResult.getTotalItems());
                }
                continue;
            }

            return searchResponse(candidates, page, limit, providerResult.getTotalItems());
        }

        log.info("Book search external providers returned no candidates");
        return searchResponse(List.of(), page, limit, 0);
    }

    private BookCandidateSearchResponse searchResponse(
            List<BookCandidateDto> candidates,
            int page,
            int limit,
            Integer totalItems
    ) {
        return BookCandidateSearchResponse.builder()
                .candidates(candidates)
                .page(page)
                .limit(limit)
                .totalItems(totalItems)
                .hasMore(hasMore(page, limit, totalItems, candidates.size()))
                .build();
    }

    /**
     * API 수준 필터·정렬 값을 정규화하고 DB에서 처리된 사용자 shelf를 응답으로 변환한다.
     */
    public BookListResponse findSavedBooks(String statusFilter, String sort) {
        String normalizedStatus = normalizeStatusFilter(statusFilter);
        String normalizedSort = BookShelfSort.normalize(sort);

        List<SaveBookResponse> books = bookMapper.findByUserId(AuthContext.requireUserId(), normalizedStatus, normalizedSort)
                .stream()
                .map(SaveBookResponse::from)
                .toList();

        return BookListResponse.builder()
                .books(books)
                .build();
    }

    /**
     * ISBN이 있는 후보만 같은 사용자의 중복 ISBN을 거부한다.
     */
    @Transactional
    public SaveBookResponse saveBook(SaveBookRequest request) {

        String isbn = resolveIsbn(request);
        // ISBN이 없는 사용자 등록 책일 경우 중복 검사 없이 저장한다.
        if(isbn != null) {
            var existing = bookMapper.findDuplicateByIsbn(AuthContext.requireUserId(), isbn);
            if (existing != null) {
                throw new ApiException(ApiErrorCode.BOOK_ALREADY_EXISTS);
            }
        }

        BookRecord record = recordFromRequest(request);

        if (bookMapper.insert(record) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Book could not be saved");
        }

        return SaveBookResponse.from(record);
    }

    /**
     * 프론트엔드 후보를 저장된 책 레코드와 provider/AI-context metadata로 변환한다.
     */
    private BookRecord recordFromRequest(SaveBookRequest saveBookRequest) {
        String isbn = resolveIsbn(saveBookRequest);
        String source = sourceFromCandidateId(saveBookRequest.getCandidateId());

        return BookRecord.builder()
                .userId(AuthContext.requireUserId())
                .title(saveBookRequest.getTitle().trim())
                .subtitle(trimOptionalToLimit(saveBookRequest.getSubtitle()))
                .author(saveBookRequest.getAuthor().trim())
                .publisher(trimOptionalToLimit(saveBookRequest.getPublisher()))
                .isbn(isbn)
                .publishedYear(saveBookRequest.getPublishedYear())
                .languageCode(trimOptionalToLimit(saveBookRequest.getLanguage(), LANGUAGE_TEXT_LIMIT))
                .description(trimOptionalToLimit(saveBookRequest.getDescription(), URL_TEXT_LIMIT))
                .source(source)
                .sourceRef(saveBookRequest.getCandidateId())
                .coverImageUrl(trimOptionalToLimit(saveBookRequest.getThumbnail(), URL_TEXT_LIMIT))
                .rawMetadata(bookMetadata(saveBookRequest.getTitle().trim(), saveBookRequest.getAuthor().trim(), isbn, saveBookRequest))
                .readingStatus(BookReadingStatus.WANT_TO_READ)
                .testData(true)
                .build();
    }

    /**
     * 독자가 수정 가능한 book identity를 갱신하고 visible field에 맞춰 AI profile 메타데이터를 새로고침한다.
     */
    public SaveBookResponse updateBook(Long bookId, UpdateBookRequest request) {

        BookRecord existing = bookMapper.findByIdForUser(bookId, AuthContext.requireUserId());
        if (existing == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book was not found");
        }

        String isbn = existing.getIsbn();

        if (isbn != null) {
            BookRecord duplicate = bookMapper.findDuplicateByIsbn(AuthContext.requireUserId(), isbn);
            if (duplicate != null && !duplicate.getId().equals(bookId)) {
                throw new ApiException(ApiErrorCode.BOOK_ALREADY_EXISTS);
            }
        }

        BookRecord update = BookRecord.builder()
                .id(bookId)
                .userId(AuthContext.requireUserId())
                .title(request.getTitle().trim())
                .author(request.getAuthor().trim())
                .publishedYear(request.getPublishedYear())
                .rawMetadata(metadataWithUpdatedAiProfile(existing.getRawMetadata(), request.getTitle().trim(), request.getAuthor().trim(), existing.getIsbn(),
                                                          request.getPublishedYear(), existing.getLanguageCode(),
                                                          existing.getSource()
                ))
                .build();
        if (bookMapper.update(update) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Book could not be updated");
        }

        return SaveBookResponse.from(bookMapper.findByIdForUser(bookId, AuthContext.requireUserId()));
    }

    /**
     * 서재 상태/평점을 갱신하고 reading analytics용 derived transition 타임스탬프를 유지한다.
     */
    public SaveBookResponse updateBookShelf(Long bookId, UpdateBookShelfRequest request) {
        Long userId = AuthContext.requireUserId();
        BookRecord bookRecord = bookMapper.findByIdForUser(bookId, userId);
        if (bookRecord == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book was not found");
        }

        BookRecord update = buildShelfUpdate(bookRecord, request);
        if (bookMapper.updateShelf(update) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Book shelf could not be updated");
        }

        // @TODO: shelf 갱신 후 최신 레코드 반환을 위한 재조회 제거 가능 여부 검토 (중복 호출)
        return SaveBookResponse.from(bookMapper.findByIdForUser(bookId, userId));
    }

    private BookRecord buildShelfUpdate(BookRecord bookRecord, UpdateBookShelfRequest request) {
        String nextStatus = resolveReadingStatus(bookRecord.getReadingStatus(), request.getReadingStatus());
        Double nextRating = resolveRating(bookRecord.getRating(), request);
        LocalDateTime statusStartedAt = bookRecord.getStatusStartedAt();
        LocalDateTime statusFinishedAt = bookRecord.getStatusFinishedAt();

        if (hasStatusChange(bookRecord.getReadingStatus(), request.getReadingStatus(), nextStatus)) {
            LocalDateTime now = LocalDateTime.now();
            if (BookReadingStatus.READING.equals(nextStatus) && statusStartedAt == null) {
                statusStartedAt = now;
            }
            if (BookReadingStatus.READ.equals(nextStatus) || BookReadingStatus.DNF.equals(nextStatus)) {
                if (statusStartedAt == null) {
                    statusStartedAt = now;
                }
                statusFinishedAt = now;
            }
            if (BookReadingStatus.WANT_TO_READ.equals(nextStatus)) {
                statusStartedAt = null;
                statusFinishedAt = null;
            }
            if (BookReadingStatus.READING.equals(nextStatus)) {
                statusFinishedAt = null;
            }
        }

        return BookRecord.builder()
                .id(bookRecord.getId())
                .userId(bookRecord.getUserId())
                .readingStatus(nextStatus)
                .rating(nextRating)
                .statusStartedAt(statusStartedAt)
                .statusFinishedAt(statusFinishedAt)
                .build();
    }

    private String resolveReadingStatus(String currentStatus, String requestedStatus) {
        if (requestedStatus == null || requestedStatus.isBlank()) {
            return currentStatus;
        }

        String normalizedStatus = BookReadingStatus.normalize(requestedStatus);
        if (!BookReadingStatus.isValid(normalizedStatus)) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "Reading status is invalid");
        }
        return normalizedStatus;
    }

    private Double resolveRating(Double currentRating, UpdateBookShelfRequest request) {
        if (request.isClearRating()) {
            return null;
        }
        return request.getRating() == null ? currentRating : normalizeRating(request.getRating());
    }

    private boolean hasStatusChange(String currentStatus, String requestedStatus, String nextStatus) {
        return requestedStatus != null
                && !requestedStatus.isBlank()
                && !Objects.equals(nextStatus, currentStatus);
    }

    /** 현재 사용자의 저장 책을 soft-delete한다. */
    public void deleteBook(Long bookId) {
        Long userId = AuthContext.requireUserId();
        if (bookMapper.softDelete(bookId, userId) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book was not found");
        }
    }

    /**
     * DB 조회에 전달할 선택 서재 필터를 검증하고 정규화한다.
     */
    private String normalizeStatusFilter(String statusFilter) {
        if (statusFilter == null || statusFilter.isBlank() || "all".equalsIgnoreCase(statusFilter.trim())) {
            return null;
        }
        String normalized = BookReadingStatus.normalize(statusFilter);
        if (!BookReadingStatus.isValid(normalized)) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "Reading status filter is invalid");
        }
        return normalized;
    }

    /**
     * 평점은 0.5 단위만 허용하고 책 서재 규약 밖의 값은 거부한다.
     */
    private Double normalizeRating(Double rating) {
        if (rating == null) {
            return null;
        }
        double halfSteps = rating * 2.0;
        if (!Double.isFinite(rating) || rating < 0.5 || rating > 5.0 || Math.abs(
                halfSteps - Math.rint(halfSteps)) > 0.000001) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "Rating must be a 0.5 step between 0.5 and 5.0");
        }
        return rating;
    }

    private boolean hasMore(int page, int limit, Integer totalItems, int returnedCount) {
        if (totalItems != null) {
            return (long) page * (long) limit < totalItems;
        }
        return returnedCount >= limit;
    }

    private String trimToLimit(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= SAVE_TEXT_LIMIT) {
            return trimmed;
        }
        return trimmed.substring(0, SAVE_TEXT_LIMIT);
    }

    private String trimIsbn(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("[^0-9Xx]", "")
                .toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return null;
        }
        if (normalized.length() <= ISBN_TEXT_LIMIT) {
            return normalized;
        }
        return normalized.substring(0, ISBN_TEXT_LIMIT);
    }

    private String resolveIsbn(SaveBookRequest request) {
        String isbn = trimIsbn(request.getIsbn());
        if (isbn != null) {
            return isbn;
        }
        isbn = trimIsbn(request.getIsbn13());
        if (isbn != null) {
            return isbn;
        }
        return trimIsbn(request.getIsbn10());
    }

    private String trimOptionalToLimit(String value) {
        return trimOptionalToLimit(value, SAVE_TEXT_LIMIT);
    }

    private String trimOptionalToLimit(String value, int limit) {
        String trimmed = trimToLimit(value, limit);
        return trimmed.isBlank() ? null : trimmed;
    }

    /**
     * 임의의 provider text를 저장 전에 column-safe 길이로 자른다.
     */
    private String trimToLimit(String value, int limit) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= limit) {
            return trimmed;
        }
        return trimmed.substring(0, limit);
    }

    /**
     * google:<id> 같은 후보 식별자에서 제공자 식별자를 보존하고, 없으면 AI/수동으로 fallback한다.
     */
    private String sourceFromCandidateId(String candidateId) {
        if (candidateId == null || !candidateId.contains(":")) {
            return "ai";
        }

        String source = candidateId.substring(0, candidateId.indexOf(':'))
                .trim()
                .toLowerCase();
        return source.isBlank() ? "ai" : trimToLimit(source);
    }

    /**
     * 제공자 메타데이터와 초기 AI 프로필 snapshot을 하나의 JSON payload에 저장한다.
     */
    private String bookMetadata(String title, String author, String isbn, SaveBookRequest request) {
        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        ObjectNode provider = root.putObject("providerMetadata");
        provider.put("candidateId", request.getCandidateId());
        provider.put("provider", sourceFromCandidateId(request.getCandidateId()));
        putOptional(provider, "isbn", isbn);
        putOptional(provider, "isbn10", trimIsbn(request.getIsbn10()));
        putOptional(provider, "isbn13", trimIsbn(request.getIsbn13()));
        putOptional(provider, "title", title);
        putOptional(provider, "subtitle", trimOptionalToLimit(request.getSubtitle()));
        putOptional(provider, "author", author);
        ArrayNode authors = provider.putArray("authors");
        if (request.getAuthors() != null) {
            request.getAuthors()
                    .stream()
                    .map(this::trimToLimit)
                    .filter((value) -> !value.isBlank())
                    .forEach(authors::add);
        }
        putOptional(provider, "publisher", trimOptionalToLimit(request.getPublisher()));
        putOptional(provider, "publishedDate", trimOptionalToLimit(request.getPublishedDate()));
        if (request.getPublishedYear() != null) {
            provider.put("publishedYear", request.getPublishedYear());
        }
        putOptional(provider, "description", trimOptionalToLimit(request.getDescription(), URL_TEXT_LIMIT));
        putOptional(provider, "thumbnail", trimOptionalToLimit(request.getThumbnail(), URL_TEXT_LIMIT));
        putOptional(provider, "language", trimOptionalToLimit(request.getLanguage(), LANGUAGE_TEXT_LIMIT));
        if (request.getPageCount() != null) {
            provider.put("pageCount", request.getPageCount());
        }

        root.set("aiProfile", aiProfileMetadata(title, author, isbn, request.getPublishedYear(),
                                                trimOptionalToLimit(request.getLanguage(), LANGUAGE_TEXT_LIMIT),
                                                sourceFromCandidateId(request.getCandidateId())
                 )
        );
        try {
            return OBJECT_MAPPER.writeValueAsString(root);
        } catch (
                JsonProcessingException exception) {
            return "{\"aiProfile\":{\"source\":{\"confidence\":\"missing\"}}}";
        }
    }

    /**
     * 기존 제공자 메타데이터는 가능한 보존하고 AI profile 부분만 교체한다.
     */
    private String metadataWithUpdatedAiProfile(String existingRawMetadata, String title, String author, String isbn, Integer publishedYear, String language, String sourceProvider) {
        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        if (existingRawMetadata != null && !existingRawMetadata.isBlank()) {
            try {
                JsonNode existing = OBJECT_MAPPER.readTree(existingRawMetadata);
                if (existing.isObject()) {
                    root = existing.deepCopy();
                }
            } catch (
                    JsonProcessingException exception) {
                log.warn("Book metadata refresh ignored invalid existing raw metadata. error={}", exception.getClass()
                        .getSimpleName()
                );
            }
        }

        root.set("aiProfile", aiProfileMetadata(title, author, isbn, publishedYear,
                                                trimOptionalToLimit(language, LANGUAGE_TEXT_LIMIT),
                                                sourceProvider == null || sourceProvider.isBlank() ? "ai" : sourceProvider
                 )
        );
        try {
            return OBJECT_MAPPER.writeValueAsString(root);
        } catch (
                JsonProcessingException exception) {
            return "{\"aiProfile\":{\"source\":{\"confidence\":\"missing\"}}}";
        }
    }

    /**
     * 지속 가능한 책 메타데이터로 보수적인 non-RAG AI context profile을 만든다.
     */
    private ObjectNode aiProfileMetadata(String title, String author, String isbn, Integer publishedYear, String language, String sourceProvider) {
        ObjectNode profile = OBJECT_MAPPER.createObjectNode();
        profile.put("isbn", isbn == null ? "" : isbn);
        profile.put("title", title);
        profile.put("author", author == null ? "" : author);
        if (publishedYear != null) {
            profile.put("publishedYear", publishedYear);
        }
        profile.put("language", language == null ? "" : language);
        profile.putArray("genre");
        profile.putArray("mood");
        profile.put("pace", "unknown");
        ArrayNode themes = profile.putArray("themes");
        themes.add("reader-reflection");
        profile.put("summaryShort", "사용자가 등록한 책 정보를 바탕으로 생성된 초기 토론 컨텍스트입니다.");
        profile.put("summaryLong", "아직 검수된 줄거리나 전문 메타데이터가 없으므로, AI는 제목, 저자, ISBN, 사용자의 세션 기록을 우선 근거로 사용해야 합니다.");
        profile.putArray("characters");
        ArrayNode discussionAngles = profile.putArray("discussionAngles");
        discussionAngles.add("문학적 관점");
        discussionAngles.add("철학적 관점");
        discussionAngles.add("심리학적 관점");
        discussionAngles.add("역사/사회적 관점");
        profile.put("spoilerLevel", "unknown");
        ObjectNode source = profile.putObject("source");
        source.put("provider", sourceProvider == null || sourceProvider.isBlank() ? "ai" : sourceProvider);
        source.put("confidence", "low");
        profile.put("generatedAt", "book-save");
        profile.put("reviewedByUser", false);
        return profile;
    }

    private void putOptional(ObjectNode node, String field, String value) {
        if (value != null && !value.isBlank()) {
            node.put(field, value);
        }
    }

    /**
     * 다른 사용 가능한 provider를 버리지 않고 설정된 provider를 앞으로 이동한다.
     */
    private List<BookSearchProvider> orderedProviders() {
        List<BookSearchProvider> providers = new ArrayList<>(bookSearchProviders);
        String preferredProvider = bookSearchProperties.getProvider();

        var preferred = providers.stream()
                .filter(provider -> preferredProvider.equalsIgnoreCase(provider.providerName()))
                .findFirst();

        preferred.ifPresent(provider -> {
            providers.remove(provider);
            providers.addFirst(provider);
        });

        return providers;
    }
}
