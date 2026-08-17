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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class OpenLibraryBookSearchProvider implements BookSearchProvider {

    private static final int CANDIDATE_TEXT_LIMIT = 255;

    private final BookSearchProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Override
    public String providerName() {
        return "openlibrary";
    }

    @Override
    public List<BookCandidateDto> search(String query) {
        return search(query, 1, properties.getLimit()).getCandidates();
    }

    @Override
    public BookSearchResult search(String query, int page, int limit) {
        if (!properties.isEnabled()) {
            log.info("Open Library book search skipped because external book search is disabled");
            return BookSearchResult.empty();
        }
        if (query == null || query.isBlank()) {
            log.info("Open Library book search skipped because query is blank");
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
                log.warn("Open Library book search failed. status={}, queryLength={}", response.statusCode(), query.trim().length());
                return BookSearchResult.empty();
            }

            BookSearchResult result = parseResult(response.body());
            log.info("Open Library book search completed. status={}, candidateCount={}, totalItems={}, page={}, limit={}, queryLength={}",
                response.statusCode(),
                result.getCandidates().size(),
                result.getTotalItems(),
                page,
                limit,
                query.trim().length());
            return result;
        } catch (IOException exception) {
            log.warn("Open Library book search failed with I/O error. queryLength={}, error={}",
                query.trim().length(),
                exception.getClass().getSimpleName());
            return BookSearchResult.empty();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.warn("Open Library book search interrupted. queryLength={}", query.trim().length());
            return BookSearchResult.empty();
        } catch (RuntimeException exception) {
            log.warn("Open Library book search failed with runtime error. queryLength={}, error={}",
                query.trim().length(),
                exception.getClass().getSimpleName());
            return BookSearchResult.empty();
        }
    }

    private URI searchUri(String query, int page, int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 40));
        String encodedQuery = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
        return URI.create(properties.getBaseUrl()
            + "/search.json?q="
            + encodedQuery
            + "&limit="
            + limit
            + "&page="
            + Math.max(1, page)
            + "&fields=key,title,author_name,first_publish_year");
    }

    private BookSearchResult parseResult(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        JsonNode docs = root.path("docs");
        if (!docs.isArray()) {
            log.warn("Open Library book search response did not contain docs array");
            return BookSearchResult.builder()
                .candidates(List.of())
                .totalItems(root.path("numFound").isInt() ? root.path("numFound").asInt() : null)
                .build();
        }

        List<BookCandidateDto> candidates = new ArrayList<>();
        for (JsonNode item : docs) {
            String key = text(item, "key");
            String title = text(item, "title");
            String author = firstAuthor(item.path("author_name"));
            if (key.isBlank() || title.isBlank() || author.isBlank()) {
                log.info("Open Library book search ignored unusable document. hasKey={}, hasTitle={}, hasAuthor={}",
                    !key.isBlank(),
                    !title.isBlank(),
                    !author.isBlank());
                continue;
            }

            candidates.add(BookCandidateDto.builder()
                .candidateId(trimToLimit("openlibrary:" + key))
                .title(title)
                .author(author)
                .publishedYear(item.path("first_publish_year").isInt() ? item.path("first_publish_year").asInt() : null)
                .build());
        }
        return BookSearchResult.builder()
            .candidates(candidates)
            .totalItems(root.path("numFound").isInt() ? root.path("numFound").asInt() : null)
            .build();
    }

    private String firstAuthor(JsonNode authors) {
        if (!authors.isArray() || authors.isEmpty()) {
            return "";
        }
        return trimToLimit(authors.get(0).asText(""));
    }

    private String text(JsonNode node, String field) {
        return trimToLimit(node.path(field).asText(""));
    }

    private String trimToLimit(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.length() <= CANDIDATE_TEXT_LIMIT
            ? trimmed
            : trimmed.substring(0, CANDIDATE_TEXT_LIMIT);
    }
}
