package com.margins.book.catalog.provider;

import com.fasterxml.jackson.databind.*;
import com.margins.book.catalog.business.CatalogJson;
import com.margins.book.catalog.business.CatalogTime;
import com.margins.book.catalog.mapper.CatalogBookMapper;
import com.margins.book.catalog.model.CatalogRows.Source;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import org.springframework.stereotype.Component;

/** Source-specific, depth-one adapters. Off until HTML metadata usage is explicitly configured. */
@Component
@RequiredArgsConstructor
public class HtmlCatalogAdapter implements CatalogAdapter {
  private final CatalogHttpClient http;
  private final CatalogRobots robots;
  private final ObjectMapper json;
  private final CatalogBookMapper books;
  private final CatalogTime time;
  private final CatalogJson payloads;

  @Override
  public boolean supports(String code) {
    return Set.of("goodreads", "kyobo", "yes24").contains(code);
  }

  @Override
  public Result search(Source source, String keyword) {
    String q = ApiCatalogAdapter.encode(keyword);
    URI search =
        URI.create(
            switch (source.getCode()) {
              case "goodreads" -> "https://www.goodreads.com/search?q=" + q;
              case "kyobo" -> "https://search.kyobobook.co.kr/search?keyword=" + q;
              case "yes24" -> "https://www.yes24.com/Product/Search?domain=ALL&query=" + q;
              default -> throw new SourceFailure("BLOCKED");
            });
    Document page = fetch(source, search);
    List<URI> links = links(source.getCode(), page);
    if (links.isEmpty()) {
      if (page.select(".no_results,.no_results_found,.result_no_data,.no_data,.sGoodsNoResult")
          .isEmpty()) throw new SourceFailure("INVALID_RESPONSE");
      return new Result(List.of(), false);
    }
    List<NormalizedBook> records = new ArrayList<>();
    for (URI link : links.stream().limit(20).toList()) {
      var cached = books.record(source.getId(), link.getPath(), source.isTestData());
      if (cached != null
          && cached.getStatus().equals("ACTIVE")
          && cached.getPolicyVersion() == source.getPolicyVersion()
          && cached.getFetchedAt().plusDays(30).isAfter(time.now())
          && (cached.getExpiresAt() == null || cached.getExpiresAt().isAfter(time.now()))) {
        records.add(payloads.read(cached.getNormalizedPayload(), NormalizedBook.class));
        continue;
      }
      NormalizedBook book = parseDetail(source.getCode(), link, fetch(source, link));
      if (book != null) records.add(book);
    }
    if (records.isEmpty()) throw new SourceFailure("INVALID_RESPONSE");
    return new Result(records, links.size() > 20);
  }

  private Document fetch(Source source, URI uri) {
    CatalogUrlPolicy.validate(source.getCode(), uri);
    robots.requireAllowed(source, uri);
    var response = http.get(source, uri, Map.of(), false, 2 * 1024 * 1024);
    if (response.status() != 200) throw new SourceFailure("INVALID_RESPONSE");
    try {
      Document page = Jsoup.parse(new ByteArrayInputStream(response.body()), null, uri.toString());
      if (!page.select(".g-recaptcha,form[action*=captcha],input[name=captcha]").isEmpty()
          || page.title().toLowerCase(Locale.ROOT).contains("access denied"))
        throw new SourceFailure("BLOCKED");
      return page;
    } catch (SourceFailure ex) {
      throw ex;
    } catch (Exception ex) {
      throw new SourceFailure("INVALID_RESPONSE");
    }
  }

  public List<URI> links(String source, Document page) {
    String selector =
        switch (source) {
          case "goodreads" -> "a[href*=/book/show/]";
          case "kyobo" -> "a[href*=product.kyobobook.co.kr/detail/]";
          case "yes24" -> "a[href*=/Product/Goods/],a[href*=/goods/]";
          default -> throw new SourceFailure("BLOCKED");
        };
    Set<URI> result = new LinkedHashSet<>();
    for (Element anchor : page.select(selector)) {
      try {
        URI raw = URI.create(ApiCatalogAdapter.https(anchor.absUrl("href")));
        URI clean = new URI(raw.getScheme(), null, raw.getHost(), -1, raw.getPath(), null, null);
        CatalogUrlPolicy.validate(source, clean);
        result.add(clean);
        if (result.size() == 21) break;
      } catch (Exception ignored) {
        /* Reject malformed or off-source links, never follow them. */
      }
    }
    return List.copyOf(result);
  }

  public NormalizedBook parseDetail(String source, URI uri, Document page) {
    String external = uri.getPath();
    for (Element script : page.select("script[type=application/ld+json]")) {
      try {
        JsonNode node = bookNode(json.readTree(script.data()));
        if (node == null) continue;
        List<String> authors = new ArrayList<>();
        JsonNode author = node.path("author");
        if (author.isArray())
          author.forEach(a -> authors.add(a.isTextual() ? a.asText() : a.path("name").asText("")));
        else authors.add(author.isTextual() ? author.asText() : author.path("name").asText(""));
        String image =
            node.path("image").isArray()
                ? node.path("image").path(0).asText()
                : node.path("image").asText("");
        String publisher =
            node.path("publisher").isTextual()
                ? node.path("publisher").asText()
                : node.path("publisher").path("name").asText("");
        return new NormalizedBook(
            external,
            uri.toString(),
            node.path("name").asText(""),
            null,
            authors,
            node.path("isbn").asText(""),
            publisher,
            node.path("datePublished").asText(""),
            node.path("inLanguage").asText(""),
            format(node.path("bookFormat").asText("")),
            null,
            null,
            ApiCatalogAdapter.https(image),
            node.path("bookEdition").asText(""));
      } catch (Exception ignored) {
        /* Source-specific DOM fallback below; missing title never becomes EMPTY. */
      }
    }
    String titleSelector, authorSelector;
    switch (source) {
      case "goodreads" -> {
        titleSelector = "h1[data-testid=bookTitle],h1#bookTitle";
        authorSelector = ".ContributorLink__name,.authorName span";
      }
      case "kyobo" -> {
        titleSelector = ".prod_title";
        authorSelector = ".prod_author a";
      }
      case "yes24" -> {
        titleSelector = ".gd_name";
        authorSelector = ".gd_auth a";
      }
      default -> throw new SourceFailure("BLOCKED");
    }
    String title =
        page.select(titleSelector).first() == null ? "" : page.select(titleSelector).first().text();
    if (title.isBlank()) throw new SourceFailure("INVALID_RESPONSE");
    var isbnMatcher =
        java.util.regex.Pattern.compile(
                "ISBN(?:13|[- ]13)?\\s*[:：]?\\s*(97[89][0-9 -]{10,20})",
                java.util.regex.Pattern.CASE_INSENSITIVE)
            .matcher(page.text());
    String isbn = isbnMatcher.find() ? isbnMatcher.group(1).replaceAll("[ -]", "") : null;
    if (isbn != null) isbn = isbn.length() >= 13 ? isbn.substring(0, 13) : null;
    return new NormalizedBook(
        external,
        uri.toString(),
        title,
        null,
        page.select(authorSelector).eachText(),
        isbn,
        null,
        null,
        null,
        "UNKNOWN",
        null,
        null,
        ApiCatalogAdapter.https(page.select("meta[property=og:image]").attr("content")),
        null);
  }

  private JsonNode bookNode(JsonNode node) {
    if (node == null) return null;
    if (node.isArray()) {
      for (JsonNode item : node) {
        JsonNode found = bookNode(item);
        if (found != null) return found;
      }
      return null;
    }
    String type = node.path("@type").asText("");
    if (node.path("@type").isArray()) {
      for (var item : node.path("@type"))
        if (item.asText().equals("Book") || item.asText().endsWith("/Book")) return node;
    }
    if (type.equals("Book") || type.endsWith("/Book")) return node;
    if (node.has("@graph")) return bookNode(node.path("@graph"));
    return null;
  }

  private String format(String value) {
    if (value.contains("EBook")) return "EBOOK";
    if (value.contains("Audiobook")) return "AUDIOBOOK";
    if (value.contains("Paperback") || value.contains("Hardcover")) return "PRINT";
    return "UNKNOWN";
  }
}
