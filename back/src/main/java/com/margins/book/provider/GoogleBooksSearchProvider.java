package com.margins.book.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.dto.BookCandidateDto;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(10)
@RequiredArgsConstructor
@Slf4j
public class GoogleBooksSearchProvider implements BookSearchProvider {

    private static final int CANDIDATE_TEXT_LIMIT = 255;
    private static final int ISBN_TEXT_LIMIT = 32;
    private static final int LANGUAGE_TEXT_LIMIT = 16;

    private final BookSearchProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    /** 제공자 정렬, 로그, 저장된 책 출처 값에 쓰는 이름이다. */
    @Override
    public String providerName() {
        return "google";
    }

    /** 비즈니스 흐름으로 예외를 던지지 않고 Google Books를 검색해 정제된 후보를 반환한다. */
    @Override
    public List<BookCandidateDto> search(String query) {
        return search(query, 1, properties.getLimit()).getCandidates();
    }

    /** 페이지 요청을 Google Books startIndex/maxResults 파라미터로 전달한다. */
    @Override
    public BookSearchResult search(String query, int page, int limit) {
        if (!properties.isEnabled()) {
            log.info("Google Books search skipped because external book search is disabled");
            return BookSearchResult.empty();
        }
        if (query == null || query.isBlank()) {
            log.info("Google Books search skipped because query is blank");
            return BookSearchResult.empty();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(searchUri(query, page, limit))
                .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                .header("Accept", "application/json")
                .GET()
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Google Books search failed. status={}, queryLength={}", response.statusCode(), query.trim().length());
                return BookSearchResult.empty();
            }

            BookSearchResult result = parseResult(response.body());
            log.info("Google Books search completed. status={}, candidateCount={}, totalItems={}, page={}, limit={}, queryLength={}, requestQuery={}",
                response.statusCode(),
                result.getCandidates().size(),
                result.getTotalItems(),
                page,
                limit,
                query.trim().length(),
                redactedRawQuery(request.uri()));
            return result;
        } catch (IOException exception) {
            log.warn("Google Books search failed with I/O error. queryLength={}, error={}",
                query.trim().length(),
                exception.getClass().getSimpleName());
            return BookSearchResult.empty();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.warn("Google Books search interrupted. queryLength={}", query.trim().length());
            return BookSearchResult.empty();
        } catch (RuntimeException exception) {
            log.warn("Google Books search failed with runtime error. queryLength={}, error={}",
                query.trim().length(),
                exception.getClass().getSimpleName());
            return BookSearchResult.empty();
        }
    }

    /** 로그에서 API 키가 가려지도록 Google Books 요청 URL을 만든다. */
    private URI searchUri(String query, int page, int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 40));
        long requestedStartIndex = Math.max(0L, ((long) Math.max(1, page) - 1L) * (long) limit);
        long startIndex = Math.min(requestedStartIndex, Integer.MAX_VALUE);
        String encodedQuery = URLEncoder.encode(googleQuery(query), StandardCharsets.UTF_8);
        String apiKey = properties.getGoogleApiKey() == null ? "" : properties.getGoogleApiKey().trim();
        String keyQuery = apiKey.isBlank()
            ? ""
            : "&key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        return URI.create(properties.getGoogleBaseUrl()
            + "/books/v1/volumes?q="
            + encodedQuery
            + "&maxResults="
            + limit
            + "&startIndex="
            + startIndex
            + "&printType=books"
            + keyQuery);
    }

    /** 요청 쿼리 문자열이 로그에 남기 전에 API 키 값을 제거한다. */
    private String redactedRawQuery(URI uri) {
        String rawQuery = uri.getRawQuery();
        if (rawQuery == null) {
            return "";
        }
        return rawQuery.replaceAll("(?i)(^|&)key=[^&]*", "$1key=<redacted>");
    }

    /** 사용자 친화적인 검색어 접두어를 Google Books 쿼리 연산자로 바꾼다. */
    private String googleQuery(String query) {
        String trimmed = query.trim();
        String lower = trimmed.toLowerCase();
        if (lower.startsWith("intitle:") || lower.startsWith("inauthor:")) {
            return trimmed;
        }
        if (lower.startsWith("isbn:")) {
            String isbn = normalizedIsbn(trimmed);
            return isbn.isBlank() ? trimmed : "isbn:" + isbn;
        }
        if (lower.startsWith("title:")) {
            return "intitle:" + trimmed.substring("title:".length()).trim();
        }
        if (lower.startsWith("author:")) {
            return "inauthor:" + trimmed.substring("author:".length()).trim();
        }

        String isbn = normalizedIsbn(trimmed);
        return isbn.isBlank() ? trimmed : "isbn:" + isbn;
    }

    private BookSearchResult parseResult(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        JsonNode items = root.path("items");
        if (!items.isArray()) {
            log.info("Google Books search response did not contain items array. totalItems={}", root.path("totalItems").asInt(0));
            return BookSearchResult.builder()
                .candidates(List.of())
                .totalItems(root.path("totalItems").isInt() ? root.path("totalItems").asInt() : null)
                .build();
        }

        List<BookCandidateDto> candidates = new ArrayList<>();
        for (JsonNode item : items) {
            JsonNode volumeInfo = item.path("volumeInfo");
            String title = text(volumeInfo, "title");
            String author = authorLabel(volumeInfo.path("authors"));
            if (title.isBlank()) {
                log.info("Google Books search ignored unusable item. hasId={}, hasTitle={}, authorCount={}",
                    !text(item, "id").isBlank(),
                    false,
                    volumeInfo.path("authors").isArray() ? volumeInfo.path("authors").size() : 0);
                continue;
            }

            String isbn10 = isbn(volumeInfo.path("industryIdentifiers"), "ISBN_10");
            String isbn13 = isbn(volumeInfo.path("industryIdentifiers"), "ISBN_13");
            String preferredIsbn = !isbn13.isBlank() ? isbn13 : isbn10;
            String googleId = text(item, "id");
            String candidateId = !preferredIsbn.isBlank() ? preferredIsbn : googleId;
            if (candidateId.isBlank()) {
                log.info("Google Books search ignored item without id or ISBN. titleLength={}", title.length());
                continue;
            }

            candidates.add(BookCandidateDto.builder()
                .candidateId(trimToLimit("google:" + candidateId, CANDIDATE_TEXT_LIMIT))
                .isbn(preferredIsbn.isBlank() ? null : preferredIsbn)
                .isbn10(isbn10.isBlank() ? null : isbn10)
                .isbn13(isbn13.isBlank() ? null : isbn13)
                .title(title)
                .subtitle(blankToNull(text(volumeInfo, "subtitle")))
                .author(author.isBlank() ? "Unknown author" : author)
                .authors(authors(volumeInfo.path("authors")))
                .publisher(blankToNull(text(volumeInfo, "publisher")))
                .publishedDate(blankToNull(text(volumeInfo, "publishedDate")))
                .publishedYear(publishedYear(text(volumeInfo, "publishedDate")))
                .description(blankToNull(text(volumeInfo, "description")))
                .thumbnail(thumbnail(volumeInfo.path("imageLinks")))
                .language(blankToNull(text(volumeInfo, "language", LANGUAGE_TEXT_LIMIT)))
                .pageCount(volumeInfo.path("pageCount").isInt() ? volumeInfo.path("pageCount").asInt() : null)
                .build());
        }
        log.info("Google Books search parsed response. itemCount={}, candidateCount={}, totalItems={}",
            items.size(),
            candidates.size(),
            root.path("totalItems").asInt(-1));
        return BookSearchResult.builder()
            .candidates(candidates)
            .totalItems(root.path("totalItems").isInt() ? root.path("totalItems").asInt() : null)
            .build();
    }

    private String text(JsonNode node, String field) {
        return text(node, field, CANDIDATE_TEXT_LIMIT);
    }

    private String text(JsonNode node, String field, int limit) {
        return trimToLimit(node.path(field).asText(""), limit);
    }

    /** Google 저자 배열을 정리된 이름 목록으로 변환한다. */
    private List<String> authors(JsonNode authors) {
        if (!authors.isArray() || authors.isEmpty()) {
            return List.of();
        }

        List<String> names = new ArrayList<>();
        for (JsonNode author : authors) {
            String name = trimToLimit(author.asText(""), CANDIDATE_TEXT_LIMIT);
            if (!name.isBlank()) {
                names.add(name);
            }
        }
        return names;
    }

    /** 단일 저자 표시 필드에 넣도록 여러 저자를 합친다. */
    private String authorLabel(JsonNode authors) {
        return trimToLimit(String.join(", ", authors(authors)), CANDIDATE_TEXT_LIMIT);
    }

    /** 요청한 Google Books 유형의 ISBN 식별자 하나를 선택한다. */
    private String isbn(JsonNode identifiers, String type) {
        if (!identifiers.isArray()) {
            return "";
        }
        for (JsonNode identifier : identifiers) {
            if (type.equals(identifier.path("type").asText(""))) {
                String normalized = identifier.path("identifier").asText("")
                    .replaceAll("[^0-9Xx]", "")
                    .toUpperCase(Locale.ROOT);
                return trimToLimit(normalized, ISBN_TEXT_LIMIT);
            }
        }
        return "";
    }

    private String trimToLimit(String value, int limit) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.length() <= limit ? trimmed : trimmed.substring(0, limit);
    }

    /** ISBN처럼 보이는 검색어를 감지해 Google Books 검색용으로 정규화한다. */
    private String normalizedIsbn(String query) {
        String normalized = query.toLowerCase().startsWith("isbn:")
            ? query.substring("isbn:".length()).trim()
            : query;
        normalized = normalized.replaceAll("[\\s-]", "");
        if (normalized.matches("(?i)\\d{9}[\\dX]|\\d{13}")) {
            return normalized.toUpperCase(Locale.ROOT);
        }
        return "";
    }

    /** Google Books 날짜 문자열에서 출간 연도를 추출한다. */
    private Integer publishedYear(String publishedDate) {
        if (publishedDate == null || publishedDate.length() < 4) {
            return null;
        }

        try {
            return Integer.valueOf(publishedDate.substring(0, 4));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    /** Google Books가 이미지 링크를 제공하면 더 큰 썸네일 필드를 우선한다. */
    private String thumbnail(JsonNode imageLinks) {
        String thumbnail = text(imageLinks, "thumbnail");
        if (!thumbnail.isBlank()) {
            return thumbnail;
        }
        return blankToNull(text(imageLinks, "smallThumbnail"));
    }

    /** 선택 제공자 필드의 null 의미를 보존한다. */
    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
