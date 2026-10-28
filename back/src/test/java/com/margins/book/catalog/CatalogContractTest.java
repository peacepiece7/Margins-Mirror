package com.margins.book.catalog;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.catalog.business.*;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.provider.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CatalogContractTest {
  ObjectMapper json = new ObjectMapper();
  ApiCatalogAdapter api = new ApiCatalogAdapter(new CatalogProperties(), null, json);

  @Test
  void normalizedKeywordsAndFiltersShareIdentity() {
    var all = CatalogText.command(new SearchRequest("  ＤＵＮＥ  ", null, null, null, null, null));
    var title =
        CatalogText.command(new SearchRequest("title:Dune", null, "ko", Format.EBOOK, null, null));
    assertThat(all.keyword()).isEqualTo(title.keyword()).isEqualTo("dune");
    assertThat(title.field()).isEqualTo(Field.TITLE);
    assertThat(CatalogText.key(new byte[32], all.keyword()))
        .isEqualTo(CatalogText.key(new byte[32], title.keyword()));
  }

  @Test
  void robotsCacheHonorsShorterFreshnessAndNeverExceedsADay() {
    assertThat(CatalogRobots.cacheSeconds(null)).isEqualTo(86400);
    assertThat(CatalogRobots.cacheSeconds("public, max-age=120")).isEqualTo(120);
    assertThat(CatalogRobots.cacheSeconds("max-age=999999")).isEqualTo(86400);
    assertThat(CatalogRobots.cacheSeconds("max-age=120, no-cache")).isZero();
    assertThat(CatalogRobots.cacheSeconds("no-store")).isZero();
    assertThat(CatalogRobots.cacheSeconds("max-age=invalid")).isZero();
  }

  @Test
  void isbnChecksumsConvertTenToThirteenWithoutAcceptingArbitraryDigits() {
    assertThat(CatalogText.isbn13("0-14-032872-6")).isEqualTo("9780140328721");
    assertThat(CatalogText.isbn13("9780140328722")).isNull();
    assertThat(CatalogText.isbn13("0123456789012")).isNull();
    assertThat(CatalogSearchBusiness.isbn10("9780140328721")).isEqualTo("0140328726");
    assertThatThrownBy(
            () ->
                CatalogText.command(
                    new SearchRequest("invalid", Field.ISBN, null, null, null, null)))
        .isInstanceOf(RuntimeException.class);
    assertThatThrownBy(
            () ->
                CatalogText.command(
                    new SearchRequest("x".repeat(201), null, null, null, null, null)))
        .isInstanceOf(RuntimeException.class);
  }

  @Test
  void openLibraryNeverMixesWorkAndEditionIsbn() throws Exception {
    var parsed =
        api.openLibrary(
                json.readTree(
                    """
{"numFound":1,"docs":[{"key":"/works/OL1W","title":"Work","isbn":["9780140328721"],"first_publish_year":1900,"author_name":["Writer"],
"editions":{"docs":[{"key":"/books/OL1M","title":"Edition","isbn":["9780425038918"],"publish_date":["August 1, 1978"],"cover_i":123,"language":["eng"]}]}}]}
"""))
            .records()
            .getFirst();
    assertThat(parsed.title()).isEqualTo("Edition");
    assertThat(parsed.isbn13()).isEqualTo("9780425038918");
    assertThat(parsed.publishedDate()).isEqualTo("1978-08-01");
    assertThat(parsed.language()).isEqualTo("en");
    assertThat(parsed.coverUrl()).contains("/123-M.jpg");
  }

  @Test
  void supportedApiFormatsMapBasicEditionFacts() throws Exception {
    var google =
        api.google(
                json.readTree(
                    """
{"totalItems":1,"items":[{"id":"volume","volumeInfo":{"title":"<b>Book</b>","authors":["Writer"],"publishedDate":"2020-02","industryIdentifiers":[{"identifier":"0140328726"}],"imageLinks":{"smallThumbnail":"http://books.google.com/books/content?id=volume"}}}]}
"""))
            .records()
            .getFirst();
    assertThat(google.title()).isEqualTo("Book");
    assertThat(google.isbn13()).isEqualTo("9780140328721");
    assertThat(google.coverUrl()).startsWith("https://");
    var kakao =
        api.kakao(
                json.readTree(
                    """
{"meta":{"is_end":true},"documents":[{"title":"Book","authors":["Writer"],"isbn":"0140328726 9780140328721","datetime":"2020-02-03T00:00:00+09:00"}]}
"""))
            .records()
            .getFirst();
    assertThat(kakao.publishedDate()).isEqualTo("2020-02-03");
    assertThat(kakao.language()).isNull();
    var naver =
        api.naver(
                json.readTree(
                    """
{"total":1,"items":[{"title":"책","author":"A^B","isbn":"9780140328721","pubdate":"20240229","link":"https://search.shopping.naver.com/book/catalog/123"}]}
"""))
            .records()
            .getFirst();
    assertThat(naver.authors()).containsExactly("A", "B");
    assertThat(naver.publishedDate()).isEqualTo("2024-02-29");
    var nl =
        api.national(
                json.readTree(
                    """
{"TOTAL_COUNT":1,"docs":[{"EA_ISBN":"9780140328721","SET_ISBN":"9780425038918","TITLE":"판본","PUBLISH_PREDATE":"2027-01-01","EBOOK_YN":"Y"}]}
"""))
            .records()
            .getFirst();
    assertThat(nl.isbn13()).isEqualTo("9780140328721");
    assertThat(nl.publishedDate()).isNull();
    assertThat(nl.setIsbn13()).isEqualTo("9780425038918");
    assertThat(nl.plannedPublicationDate()).isEqualTo("2027-01-01");
    assertThat(nl.format()).isEqualTo("EBOOK");
  }

  @Test
  void retiredAladinIsNotSupportedOrAllowedByUrlPolicy() {
    assertThat(api.supports("aladin")).isFalse();
    assertThatThrownBy(
            () ->
                CatalogUrlPolicy.validate(
                    "aladin",
                    URI.create("https://www.aladin.co.kr/ttb/api/ItemSearch.aspx")))
        .isInstanceOf(SourceFailure.class);
  }

  @Test
  void malformedResponsesNeverBecomeSuccessfulEmpty() throws Exception {
    assertThat(api.google(json.readTree("{\"totalItems\":0}")).records()).isEmpty();
    assertThatThrownBy(() -> api.google(json.readTree("{}"))).isInstanceOf(SourceFailure.class);
    assertThatThrownBy(
            () -> api.openLibrary(json.readTree("{\"docs\":[{\"key\":\"/works/OL1W\"}]}")))
        .isInstanceOf(SourceFailure.class);
    assertThatThrownBy(
            () ->
                api.national(
                    json.readTree(
                        "{\"docs\":[{\"TITLE\":\"Set only\",\"SET_ISBN\":\"9780140328721\"}]}")))
        .isInstanceOf(SourceFailure.class);
  }

  @Test
  void htmlAdaptersParseEditionJsonLdAndRejectOffsiteLinks() {
    var html = new HtmlCatalogAdapter(null, null, json, null, null, null);
    for (String source : List.of("goodreads", "kyobo", "yes24")) {
      String url =
          switch (source) {
            case "goodreads" -> "https://www.goodreads.com/book/show/123";
            case "kyobo" -> "https://product.kyobobook.co.kr/detail/S1";
            default -> "https://www.yes24.com/Product/Goods/123";
          };
      var doc =
          Jsoup.parse(
              """
<script type="application/ld+json">{"@graph":[{"@type":["Product","Book"],"name":"Fixture","author":{"name":"Writer"},"isbn":"9780140328721","bookFormat":"https://schema.org/Paperback"}]}</script>
""",
              url);
      assertThat(html.parseDetail(source, URI.create(url), doc).title()).isEqualTo("Fixture");
    }
    var page =
        Jsoup.parse(
            "<a href='https://evil.example/Product/Goods/1'>bad</a><a"
                + " href='/Product/Goods/2?tracking=a'>ok</a>",
            "https://www.yes24.com/Product/Search");
    assertThat(html.links("yes24", page))
        .containsExactly(URI.create("https://www.yes24.com/Product/Goods/2"));
  }

  @Test
  void robotsAppliesLongestRuleAndSpecificEmptyGroup() {
    assertThat(CatalogRobots.allows("User-agent: *\nDisallow: /\nAllow: /book/", "/book/123"))
        .isTrue();
    assertThat(CatalogRobots.allows("User-agent: *\nDisallow: /search?*", "/search?q=test"))
        .isFalse();
    assertThat(
            CatalogRobots.allows(
                "User-agent: *\nDisallow: /\nUser-agent: MarginsBookCatalog\nDisallow:", "/search"))
        .isTrue();
    assertThat(
            CatalogRobots.allows(
                "User-agent: MarginsBookCatalog\nDisallow: /book/\nAllow: /book/allowed$",
                "/book/allowed/more"))
        .isFalse();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "127.0.0.1",
        "10.0.0.1",
        "169.254.169.254",
        "100.64.0.1",
        "192.168.1.1",
        "::1",
        "fc00::1",
        "2001:db8::1",
        "198.18.0.1"
      })
  void blocksPrivateAndReservedDestinations(String address) throws Exception {
    assertThat(CatalogUrlPolicy.publicAddress(InetAddress.getByName(address))).isFalse();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "http://openlibrary.org/search.json",
        "https://openlibrary.org.evil.test/search.json",
        "https://127.0.0.1/search.json",
        "https://user@openlibrary.org/search.json",
        "https://openlibrary.org:8443/search.json",
        "https://openlibrary.org/admin"
      })
  void blocksUnapprovedUrls(String url) {
    assertThatThrownBy(() -> CatalogUrlPolicy.validate("open_library", URI.create(url)))
        .isInstanceOf(SourceFailure.class);
  }

  @Test
  void thumbnailIsContainedAndTinyAndRejectsHtml() throws Exception {
    var image = new BufferedImage(1000, 500, BufferedImage.TYPE_INT_RGB);
    var bytes = new ByteArrayOutputStream();
    ImageIO.write(image, "png", bytes);
    var processor = new CatalogCoverProcessor();
    var result = processor.minimize(bytes.toByteArray());
    assertThat(result.width()).isEqualTo(160);
    assertThat(result.height()).isEqualTo(80);
    assertThat(result.bytes()).hasSizeLessThanOrEqualTo(32768);
    assertThat(ImageIO.read(new java.io.ByteArrayInputStream(result.bytes())).getWidth())
        .isEqualTo(160);
    assertThatThrownBy(() -> processor.minimize("<html>not a cover</html>".getBytes()))
        .isInstanceOf(SourceFailure.class);
  }
}
