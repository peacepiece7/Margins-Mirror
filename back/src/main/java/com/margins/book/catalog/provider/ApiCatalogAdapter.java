package com.margins.book.catalog.provider;

import com.fasterxml.jackson.databind.*;
import com.margins.book.catalog.business.CatalogText;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.model.CatalogRows.Source;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ApiCatalogAdapter implements CatalogAdapter {
  private final CatalogProperties properties;
  private final CatalogHttpClient http;
  private final ObjectMapper json;

  @Override
  public boolean supports(String code) {
    return Set.of("open_library", "google_books", "kakao_books", "nl_seoji", "naver_books")
        .contains(code);
  }

  @Override
  public Result search(Source source, String keyword) {
    return search(source, keyword, 1);
  }

  @Override
  public Result search(Source source, String keyword, int page) {
    if (page < 1 || page > 5) throw new SourceFailure("INVALID_PAGE");
    String q = encode(keyword);
    return switch (source.getCode()) {
      case "open_library" ->
          openLibrary(
              fetch(
                  source,
                  "https://openlibrary.org/search.json?q="
                      + q
                      + "&page="
                      + page
                      + "&limit=20&fields=key,title,author_name,editions,editions.key,editions.title,editions.subtitle,editions.isbn,editions.publisher,editions.publish_date,editions.language,editions.cover_i",
                  Map.of()),
              page);
      case "google_books" ->
          google(
              fetch(
                  source,
                  "https://www.googleapis.com/books/v1/volumes?q="
                      + q
                      + "&maxResults=20&startIndex="
                      + ((page - 1) * 20)
                      + "&printType=books"
                      + (properties.getGoogleApiKey().isBlank()
                          ? ""
                          : "&key=" + encode(properties.getGoogleApiKey())),
                  Map.of()),
              page);
      case "kakao_books" ->
          kakao(
              fetch(
                  source,
                  "https://dapi.kakao.com/v3/search/book?query=" + q + "&size=20&page=" + page,
                  Map.of("Authorization", "KakaoAK " + properties.getKakaoApiKey())));
      case "naver_books" ->
          naver(
              fetch(
                  source,
                  "https://openapi.naver.com/v1/search/book.json?query="
                      + q
                      + "&display=20&start="
                      + ((page - 1) * 20 + 1),
                  Map.of(
                      "X-Naver-Client-Id",
                      properties.getNaverClientId(),
                      "X-Naver-Client-Secret",
                      properties.getNaverClientSecret())),
              page);
      case "nl_seoji" -> nationalLibrary(source, keyword);
      default -> throw new SourceFailure("BLOCKED");
    };
  }

  private JsonNode fetch(Source source, String url, Map<String, String> headers) {
    var response = http.get(source, URI.create(url), headers, false, 2 * 1024 * 1024);
    if (response.status() != 200) throw new SourceFailure("INVALID_RESPONSE");
    try {
      JsonNode result = json.readTree(response.body());
      if (result == null || !result.isObject()) throw new SourceFailure("INVALID_RESPONSE");
      if (result.has("error") || result.has("errorCode") || result.has("errorType"))
        throw new SourceFailure("INVALID_RESPONSE");
      return result;
    } catch (SourceFailure ex) {
      throw ex;
    } catch (Exception ex) {
      throw new SourceFailure("INVALID_RESPONSE");
    }
  }

  public Result openLibrary(JsonNode root) {
    return openLibrary(root, 1);
  }

  private Result openLibrary(JsonNode root, int page) {
    JsonNode docs = array(root, "docs", false);
    List<NormalizedBook> result = new ArrayList<>();
    for (JsonNode work : docs) {
      JsonNode editions = work.path("editions").path("docs");
      if (!editions.isArray()) continue;
      for (JsonNode edition : editions) {
        String key = text(edition, "key");
        if (!key.matches("/books/OL[0-9]+M")) continue;
        // Only edition ISBNs/dates are used; work-level ISBN arrays/first_publish_year are never
        // inherited.
        String isbn = isbn(edition.path("isbn"));
        String title = text(edition, "title");
        if (title.isBlank()) title = text(work, "title");
        String cover =
            edition.path("cover_i").canConvertToLong() && edition.path("cover_i").asLong() > 0
                ? "https://covers.openlibrary.org/b/id/"
                    + edition.path("cover_i").asLong()
                    + "-M.jpg?default=false"
                : null;
        result.add(
            new NormalizedBook(
                key,
                "https://openlibrary.org" + key,
                title,
                text(edition, "subtitle"),
                strings(work.path("author_name")),
                isbn,
                first(edition.path("publisher")),
                first(edition.path("publish_date")),
                first(edition.path("language")),
                "UNKNOWN",
                null,
                null,
                cover,
                null));
        if (result.size() == 20) break;
      }
      if (result.size() == 20) break;
    }
    if (!docs.isEmpty() && result.isEmpty()) throw new SourceFailure("INVALID_RESPONSE");
    return new Result(
        result, root.path("numFound").asInt(root.path("num_found").asInt()) > page * 20);
  }

  public Result google(JsonNode root) {
    return google(root, 1);
  }

  private Result google(JsonNode root, int page) {
    JsonNode items = array(root, "items", root.path("totalItems").asInt(-1) == 0);
    List<NormalizedBook> result = new ArrayList<>();
    for (JsonNode item : items) {
      JsonNode volume = item.path("volumeInfo");
      String id = text(item, "id");
      if (id.isBlank() || !id.matches("[A-Za-z0-9_-]+") || text(volume, "title").isBlank())
        continue;
      List<String> identifiers = new ArrayList<>();
      volume.path("industryIdentifiers").forEach(n -> identifiers.add(text(n, "identifier")));
      String isbn = firstIsbn(identifiers);
      String thumb = text(volume.path("imageLinks"), "smallThumbnail");
      if (thumb.isBlank()) thumb = text(volume.path("imageLinks"), "thumbnail");
      result.add(
          new NormalizedBook(
              id,
              "https://books.google.com/books?id=" + encode(id),
              text(volume, "title"),
              text(volume, "subtitle"),
              strings(volume.path("authors")),
              isbn,
              text(volume, "publisher"),
              text(volume, "publishedDate"),
              text(volume, "language"),
              item.path("saleInfo").path("isEbook").asBoolean() ? "EBOOK" : "PRINT",
              integer(volume, "pageCount"),
              null,
              https(thumb),
              null));
    }
    return finish(items, result, root.path("totalItems").asInt() > page * 20);
  }

  public Result kakao(JsonNode root) {
    JsonNode items = array(root, "documents", false);
    List<NormalizedBook> result = new ArrayList<>();
    for (JsonNode item : items) {
      String isbn = firstIsbn(Arrays.asList(text(item, "isbn").split("\\s+")));
      if (text(item, "title").isBlank()) continue;
      String ref = isbn != null ? isbn : CatalogText.hex(CatalogText.hash(text(item, "url")));
      List<String> contributors = new ArrayList<>(strings(item.path("authors")));
      List<NormalizedBook.Contributor> roles = new ArrayList<>();
      contributors.forEach(name -> roles.add(new NormalizedBook.Contributor(name, "AUTHOR")));
      strings(item.path("translators"))
          .forEach(name -> roles.add(new NormalizedBook.Contributor(name, "TRANSLATOR")));
      String published = text(item, "datetime");
      if (published.length() >= 10) published = published.substring(0, 10);
      result.add(
          new NormalizedBook(
                  ref,
                  "https://search.daum.net/search?w=bookpage&q="
                      + encode(isbn != null ? isbn : text(item, "title")),
                  text(item, "title"),
                  null,
                  contributors,
                  isbn,
                  text(item, "publisher"),
                  published,
                  null,
                  "UNKNOWN",
                  null,
                  null,
                  https(text(item, "thumbnail")),
                  null)
              .withSupplement(roles, null, null));
    }
    return finish(items, result, !root.path("meta").path("is_end").asBoolean(true));
  }

  public Result naver(JsonNode root) {
    return naver(root, 1);
  }

  private Result naver(JsonNode root, int page) {
    JsonNode items = array(root, "items", false);
    List<NormalizedBook> result = new ArrayList<>();
    for (JsonNode item : items) {
      String isbn = firstIsbn(Arrays.asList(text(item, "isbn").split("\\s+")));
      if (text(item, "title").isBlank()) continue;
      String id = isbn != null ? isbn : CatalogText.hex(CatalogText.hash(text(item, "link")));
      String date = text(item, "pubdate");
      if (date.matches("\\d{8}"))
        date = date.substring(0, 4) + "-" + date.substring(4, 6) + "-" + date.substring(6);
      result.add(
          new NormalizedBook(
              id,
              https(text(item, "link")),
              text(item, "title"),
              null,
              Arrays.asList(text(item, "author").split("\\^")),
              isbn,
              text(item, "publisher"),
              date,
              null,
              "UNKNOWN",
              null,
              null,
              https(text(item, "image")),
              null));
    }
    return finish(items, result, root.path("total").asInt() > page * 20);
  }

  private Result nationalLibrary(Source source, String keyword) {
    String isbn = CatalogText.isbn13(keyword);
    String base =
        "https://www.nl.go.kr/seoji/SearchApi.do?cert_key="
            + encode(properties.getNlApiKey())
            + "&result_style=json&page_no=1&page_size=20&";
    if (isbn != null) return national(fetch(source, base + "isbn=" + isbn, Map.of()));
    Result titles = national(fetch(source, base + "title=" + encode(keyword), Map.of()));
    Result authors = national(fetch(source, base + "author=" + encode(keyword), Map.of()));
    Map<String, NormalizedBook> combined = new LinkedHashMap<>();
    titles.records().forEach(b -> combined.put(b.externalId(), b));
    authors.records().forEach(b -> combined.putIfAbsent(b.externalId(), b));
    return new Result(
        combined.values().stream().limit(20).toList(),
        combined.size() > 20 || titles.hasMore() || authors.hasMore());
  }

  public Result national(JsonNode root) {
    JsonNode items = array(root, "docs", false);
    List<NormalizedBook> result = new ArrayList<>();
    for (JsonNode item : items) {
      String isbn = CatalogText.isbn13(text(item, "EA_ISBN"));
      if (isbn == null || text(item, "TITLE").isBlank()) continue;
      result.add(
          new NormalizedBook(
                  isbn,
                  "https://www.nl.go.kr/NL/contents/search.do?kwd=" + isbn,
                  text(item, "TITLE"),
                  null,
                  List.of(text(item, "AUTHOR")),
                  isbn,
                  text(item, "PUBLISHER"),
                  null,
                  null,
                  text(item, "EBOOK_YN").equalsIgnoreCase("Y") ? "EBOOK" : "PRINT",
                  null,
                  null,
                  null,
                  text(item, "EDITION_STMT"))
              .withSupplement(null, text(item, "SET_ISBN"), text(item, "PUBLISH_PREDATE")));
      // SET_ISBN and PUBLISH_PREDATE deliberately do not become edition ISBN / confirmed
      // publication date.
    }
    return finish(items, result, root.path("TOTAL_COUNT").asInt() > 20);
  }

  private Result finish(JsonNode items, List<NormalizedBook> results, boolean more) {
    if (!items.isEmpty() && results.isEmpty()) throw new SourceFailure("INVALID_RESPONSE");
    return new Result(results.stream().limit(20).toList(), more || results.size() > 20);
  }

  private JsonNode array(JsonNode root, String key, boolean allowMissing) {
    JsonNode value = root.path(key);
    if (allowMissing && value.isMissingNode()) return json.createArrayNode();
    if (!value.isArray()) throw new SourceFailure("INVALID_RESPONSE");
    return value;
  }

  static String text(JsonNode node, String field) {
    return node.path(field).asText("");
  }

  static String first(JsonNode node) {
    return node.isArray() && !node.isEmpty() ? node.get(0).asText("") : node.asText("");
  }

  static List<String> strings(JsonNode node) {
    if (!node.isArray()) return List.of();
    List<String> values = new ArrayList<>();
    node.forEach(n -> values.add(n.asText("")));
    return values;
  }

  static String isbn(JsonNode values) {
    return firstIsbn(strings(values));
  }

  static String firstIsbn(List<String> values) {
    return values.stream()
        .map(CatalogText::isbn13)
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  static Integer integer(JsonNode node, String key) {
    return node.path(key).canConvertToInt() ? node.path(key).asInt() : null;
  }

  static String https(String url) {
    return url == null ? null : url.replaceFirst("^http://", "https://");
  }

  static String encode(String s) {
    return URLEncoder.encode(s, StandardCharsets.UTF_8);
  }
}
