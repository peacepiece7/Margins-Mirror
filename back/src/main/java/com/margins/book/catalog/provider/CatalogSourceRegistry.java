package com.margins.book.catalog.provider;

import com.margins.book.catalog.business.CatalogJson;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.mapper.CatalogSourceMapper;
import com.margins.book.catalog.model.CatalogRows.Source;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CatalogSourceRegistry {
  private final CatalogProperties properties;
  private final CatalogSourceMapper mapper;
  private final CatalogJson json;
  private final com.margins.book.catalog.business.CatalogTime time;
  private volatile boolean initialized;

  public synchronized void initialize() {
    if (initialized) return;
    if (properties.isTestData()) mapper.ensureTestSources();
    for (Source source : mapper.sources(properties.isTestData())) {
      boolean approved =
          properties.getMetadataSources().contains(source.getCode())
              || ("HTML".equals(source.getAdapterType())
                  && properties.getHtmlSources().contains(source.getCode()));
      source.setMetadataPolicy(approved ? "ALLOWED" : "UNREVIEWED");
      source.setCoverPolicy(
          properties.getCoverSources().contains(source.getCode()) ? "ALLOWED" : "UNREVIEWED");
      source.setStatus(approved && configured(source.getCode()) ? "ACTIVE" : "DISABLED");
      source.setPolicyReference(reference(source.getCode()));
      source.setApprovedFields(
          json.write(
              List.of(
                  "title",
                  "subtitle",
                  "authors",
                  "isbn13",
                  "publisher",
                  "publishedDate",
                  "language",
                  "format",
                  "pageCount",
                  "editionStatement",
                  "contributors",
                  "setIsbn13",
                  "plannedPublicationDate")));
      mapper.configure(source);
    }
    initialized = true;
  }

  public List<Source> sources() {
    initialize();
    return mapper.sources(properties.isTestData());
  }

  public boolean configured(String code) {
    return switch (code) {
      case "open_library" -> true;
      case "google_books" -> !properties.getGoogleApiKey().isBlank();
      case "kakao_books" -> !properties.getKakaoApiKey().isBlank();
      case "nl_seoji" -> !properties.getNlApiKey().isBlank();
      case "naver_books" ->
          !properties.getNaverClientId().isBlank() && !properties.getNaverClientSecret().isBlank();
      case "goodreads", "kyobo", "yes24" -> properties.getHtmlSources().contains(code);
      default -> false;
    };
  }

  public String readiness(Source source) {
    if (!configured(source.getCode()))
      return "HTML".equals(source.getAdapterType()) ? "REVIEW_REQUIRED" : "MISSING_KEY";
    if (!"ALLOWED".equals(source.getMetadataPolicy())) return "REVIEW_REQUIRED";
    if (source.getPolicyExpiresAt() != null && !source.getPolicyExpiresAt().isAfter(time.now()))
      return "REVIEW_REQUIRED";
    return "READY";
  }

  public static boolean allowed(Source source, LocalDateTime now, boolean cover) {
    return source != null
        && "ACTIVE".equals(source.getStatus())
        && "ALLOWED".equals(source.getMetadataPolicy())
        && (!cover || "ALLOWED".equals(source.getCoverPolicy()))
        && (source.getPolicyExpiresAt() == null || source.getPolicyExpiresAt().isAfter(now));
  }

  private String reference(String code) {
    return switch (code) {
      case "open_library" -> "https://openlibrary.org/developers/api";
      case "google_books" -> "https://developers.google.com/books/terms";
      case "kakao_books" ->
          "https://developers.kakao.com/docs/ko/daum-search/dev-guide#search-book";
      case "nl_seoji" -> "https://www.nl.go.kr/NL/contents/N31101030500.do";
      case "naver_books" -> "https://developers.naver.com/docs/serviceapi/search/book/book.md";
      case "goodreads" -> "https://www.goodreads.com/robots.txt";
      case "kyobo" -> "https://www.kyobobook.co.kr/robots.txt";
      case "yes24" -> "https://www.yes24.com/robots.txt";
      default -> "";
    };
  }
}
