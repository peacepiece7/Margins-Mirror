package com.margins.book.catalog;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.catalog.business.*;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.CatalogSourceMapper;
import com.margins.book.catalog.model.CatalogRows.Source;
import com.margins.book.catalog.provider.*;
import jakarta.validation.Validation;
import java.util.*;
import org.junit.jupiter.api.Test;

class CatalogReliabilityTest {
  private NormalizedBook book(String title, String author) {
    return book(title, author, null, "en", "UNKNOWN");
  }

  private NormalizedBook book(
      String title, String author, String isbn13, String language, String format) {
    return new NormalizedBook(
        "/books/OL1M",
        "https://openlibrary.org/books/OL1M",
        title,
        null,
        List.of(author),
        isbn13,
        null,
        null,
        language,
        format,
        null,
        null,
        null,
        null);
  }

  private CatalogText.Command command(String keyword) {
    return CatalogText.command(new SearchRequest(keyword, null, null, null, 20, Intent.REBUILD));
  }

  @Test
  void localNgramsCannotInventMatchesButProviderTransliterationsRemain() {
    var harry = book("Harry Potter and the Sorcerer's Stone", "J. K. Rowling");
    for (String query :
        List.of("Michael Ende", "The Lord of the Rings", "Andy Weir", "Project Hail Mary"))
      assertThat(CatalogRelevance.matches(harry, command(query), false)).as(query).isFalse();
    assertThat(CatalogRelevance.matches(harry, command("해리포터"), true)).isTrue();
    assertThat(CatalogRelevance.matches(harry, command("해리포터"), false)).isFalse();
    assertThat(
            CatalogRelevance.matches(book("Momo", "Michael Ende"), command("Michael Ende"), false))
        .isTrue();
    assertThat(
            CatalogRelevance.matches(
                book("Neverending Story", "Michael Ende"), command("Ende"), false))
        .isTrue();
    assertThat(CatalogRelevance.matches(book("Momo", "Michael Ender"), command("Ende"), false))
        .isTrue();
    assertThat(CatalogRelevance.matches(book("Defender", "Writer"), command("Ende"), false))
        .isFalse();
    assertThat(CatalogRelevance.matches(book("모모", "미하엘 엔데"), command("미하엘엔데"), false)).isTrue();
    assertThat(CatalogRelevance.matches(book("한국 작품", "작가"), command("한"), false)).isTrue();
  }

  @Test
  void providerHitAloneCannotMakeUnrelatedGreekMythologyTitlesRelevant() {
    var query = command("그리스 로마 신화 1권");
    for (String title : List.of("符籍大事典: 제 1권. 이론 편", "韓國出版年鑑"))
      assertThat(CatalogRelevance.match(book(title, "fixture author"), query, true))
          .as(title)
          .isEqualTo(CatalogRelevance.Match.NONE);

    assertThat(
            CatalogRelevance.match(book("그리스 로마 신화 1권", "fixture author"), query, true))
        .isEqualTo(CatalogRelevance.Match.EXACT);
    assertThat(
            CatalogRelevance.match(book("그리스 로마 신화 제1권", "fixture author"), query, false))
        .isEqualTo(CatalogRelevance.Match.TOKEN);
    assertThat(
            CatalogRelevance.matches(
                book("希臘羅馬神話第一卷", "fixture author"),
                command("希臘羅馬神話第一卷"),
                true))
        .isTrue();
    assertThat(
            CatalogRelevance.match(
                book("Harry Potter and the Sorcerer's Stone", "J. K. Rowling"),
                command("해리포터"),
                true))
        .isEqualTo(CatalogRelevance.Match.PROVIDER);
  }

  @Test
  void providerHitStillHonorsExplicitFieldLanguageAndFormat() {
    var harry = book("Harry Potter", "J. K. Rowling");
    assertThat(
            CatalogRelevance.matches(
                harry,
                CatalogText.command(
                    new SearchRequest("Tolkien", Field.AUTHOR, null, null, 20, Intent.REBUILD)),
                true))
        .isFalse();
    assertThat(
            CatalogRelevance.matches(
                harry,
                CatalogText.command(
                    new SearchRequest("Harry", null, "ko", null, 20, Intent.REBUILD)),
                true))
        .isFalse();
    assertThat(
            CatalogRelevance.matches(
                harry,
                CatalogText.command(
                    new SearchRequest("Harry", null, null, Format.PRINT, 20, Intent.REBUILD)),
                true))
        .isFalse();
  }

  @Test
  void isbnSearchIsExactAndDoesNotBypassExplicitFieldFilters() {
    var identified =
        book("Harry Potter and the Sorcerer's Stone", "J. K. Rowling", "9788936433598", "en", "PRINT");
    var isbnQuery = command("9788936433598");
    assertThat(CatalogRelevance.match(identified, isbnQuery, false))
        .isEqualTo(CatalogRelevance.Match.ISBN);
    assertThat(
            CatalogRelevance.match(
                book("Different book", "Different author", "9788983925459", "en", "PRINT"),
                isbnQuery,
                true))
        .isEqualTo(CatalogRelevance.Match.NONE);

    for (Field field : List.of(Field.TITLE, Field.AUTHOR)) {
      var filtered =
          CatalogText.command(
              new SearchRequest("9788936433598", field, null, null, 20, Intent.REBUILD));
      assertThat(CatalogRelevance.match(identified, filtered, true))
          .as(field.name())
          .isEqualTo(CatalogRelevance.Match.NONE);
    }

    var authorQuery =
        CatalogText.command(
            new SearchRequest("J. K. Rowling", Field.AUTHOR, null, null, 20, Intent.REBUILD));
    var authorAsTitle =
        CatalogText.command(
            new SearchRequest("J. K. Rowling", Field.TITLE, null, null, 20, Intent.REBUILD));
    var titleAsAuthor =
        CatalogText.command(
            new SearchRequest("Harry Potter", Field.AUTHOR, null, null, 20, Intent.REBUILD));
    assertThat(CatalogRelevance.match(identified, authorQuery, true))
        .isEqualTo(CatalogRelevance.Match.EXACT);
    assertThat(CatalogRelevance.match(identified, authorAsTitle, true))
        .isEqualTo(CatalogRelevance.Match.NONE);
    assertThat(CatalogRelevance.match(identified, titleAsAuthor, true))
        .isEqualTo(CatalogRelevance.Match.NONE);
  }

  @Test
  void relevanceOutranksProviderOrderAndWeirAliasesAreExplicit() {
    for (String keyword : List.of("엔디위어", "엔디 위어", "앤디위어", "앤디 위어", "Andy Weir")) {
      var command = command(keyword);
      var relevant = CatalogRelevance.match(book("마션", "앤디 위어 (Andy Weir)"), command, true);
      var unrelated = CatalogRelevance.match(book("오늘 엄마가 공부하는 이유", "이미애"), command, true);
      assertThat(relevant.ordinal()).isLessThan(unrelated.ordinal());
      assertThat(CatalogRelevance.matches(book("마션", "앤디위어"), command, false)).isTrue();
    }
    assertThat(CatalogRelevance.match(book("무관한 책", "다른 작가"), command("엔디 위어"), false))
        .isEqualTo(CatalogRelevance.Match.NONE);
    assertThat(CatalogRelevance.match(book("모모", "미하엘 엔데"), command("미하엘엔데"), false))
        .isEqualTo(CatalogRelevance.Match.EXACT);
  }

  @Test
  void providerPaginationUsesCorrectOffsetsAndStopsAtReportedEnd() {
    var http = mock(CatalogHttpClient.class);
    when(http.get(any(), any(), anyMap(), eq(false), anyInt()))
        .thenAnswer(
            call -> {
              Source source = call.getArgument(0);
              java.net.URI uri = call.getArgument(1);
              String payload;
              switch (source.getCode()) {
                case "open_library" -> {
                  assertThat(uri.getQuery()).contains("page=2", "limit=20");
                  payload = "{\"docs\":[],\"numFound\":35}";
                }
                case "google_books" -> {
                  assertThat(uri.getQuery()).contains("startIndex=20", "maxResults=20");
                  payload = "{\"items\":[],\"totalItems\":35}";
                }
                case "naver_books" -> {
                  assertThat(uri.getQuery()).contains("start=21", "display=20");
                  payload = "{\"items\":[],\"total\":35}";
                }
                default -> {
                  assertThat(uri.getQuery()).contains("page=2", "size=20");
                  payload = "{\"documents\":[],\"meta\":{\"is_end\":true}}";
                }
              }
              return new CatalogHttpClient.Response(
                  payload.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                  "application/json",
                  200);
            });
    var adapter = new ApiCatalogAdapter(new CatalogProperties(), http, new ObjectMapper());
    for (String code : List.of("open_library", "google_books", "naver_books", "kakao_books")) {
      Source source = new Source();
      source.setCode(code);
      assertThat(adapter.search(source, "fixture", 2).hasMore()).as(code).isFalse();
    }
  }

  @Test
  void googleNeedsAKeyWhileOpenLibraryRemainsKeyless() {
    var properties = new CatalogProperties();
    assertThat(properties.getMetadataSources()).doesNotContain("aladin");
    var mapper = mock(CatalogSourceMapper.class);
    Source google = new Source(), openLibrary = new Source();
    google.setCode("google_books");
    openLibrary.setCode("open_library");
    google.setAdapterType("API");
    openLibrary.setAdapterType("API");
    when(mapper.sources(false)).thenReturn(List.of(google, openLibrary));
    var registry =
        new CatalogSourceRegistry(
            properties, mapper, new CatalogJson(new ObjectMapper()), new CatalogTime());
    registry.initialize();
    assertThat(google.getStatus()).isEqualTo("DISABLED");
    assertThat(registry.readiness(google)).isEqualTo("MISSING_KEY");
    assertThat(openLibrary.getStatus()).isEqualTo("ACTIVE");
    assertThat(registry.readiness(openLibrary)).isEqualTo("READY");
    properties.setGoogleApiKey("synthetic-key-not-used-for-http");
    assertThat(registry.configured("google_books")).isTrue();
    assertThat(registry.configured("aladin")).isFalse();
  }

  @Test
  void timeoutBudgetsStayBoundedBelowLeaseAndPreserveCoverIsolation() {
    var properties = new CatalogProperties();
    assertThat(properties.timeoutSeconds("open_library", false)).isEqualTo(25);
    assertThat(properties.timeoutSeconds("google_books", false)).isEqualTo(10);
    assertThat(properties.timeoutSeconds("open_library", true)).isEqualTo(10);
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      assertThat(validator.validate(properties)).isEmpty();
      properties.setOpenLibraryTimeoutSeconds(0);
      assertThat(validator.validate(properties)).hasSize(1);
      properties.setOpenLibraryTimeoutSeconds(46);
      assertThat(validator.validate(properties)).hasSize(1);
      properties.setOpenLibraryTimeoutSeconds(45);
      assertThat(validator.validate(properties)).isEmpty();
    }
  }
}
