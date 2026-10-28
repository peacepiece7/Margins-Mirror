package com.margins.book.catalog.provider;

import java.net.*;
import java.util.*;

/** Validate the URL, then resolve/check again inside the transport's actual connection resolver. */
public final class CatalogUrlPolicy {
  private CatalogUrlPolicy() {}

  public static URI validate(String source, URI uri) {
    String host = Objects.requireNonNullElse(uri.getHost(), "").toLowerCase(Locale.ROOT);
    if (!"https".equalsIgnoreCase(uri.getScheme())
        || uri.getUserInfo() != null
        || uri.getFragment() != null
        || (uri.getPort() != -1 && uri.getPort() != 443)
        || host.isBlank()
        || !host.matches("[a-z0-9.-]+")
        || host.matches("[0-9.]+")
        || !allowedHost(source, host)) throw new SourceFailure("BLOCKED");
    String path = uri.normalize().getPath();
    if (path == null || path.contains("..") || !allowedPath(source, host, path))
      throw new SourceFailure("BLOCKED");
    return uri;
  }

  static boolean allowedHost(String source, String host) {
    return switch (source) {
      case "open_library" ->
          host.equals("openlibrary.org")
              || host.equals("covers.openlibrary.org")
              || host.equals("archive.org")
              || host.endsWith(".archive.org");
      case "google_books" ->
          host.equals("www.googleapis.com")
              || host.equals("books.google.com")
              || host.equals("books.google.co.kr");
      case "kakao_books" ->
          host.equals("dapi.kakao.com")
              || host.equals("search.daum.net")
              || host.equals("search1.kakaocdn.net")
              || host.endsWith(".daumcdn.net");
      case "nl_seoji" -> host.equals("www.nl.go.kr");
      case "naver_books" ->
          host.equals("openapi.naver.com")
              || host.equals("shopping-phinf.pstatic.net")
              || host.equals("bookthumb-phinf.pstatic.net")
              || host.equals("search.shopping.naver.com");
      case "goodreads" ->
          host.equals("www.goodreads.com")
              || host.equals("goodreads.com")
              || host.equals("i.gr-assets.com")
              || host.equals("images-na.ssl-images-amazon.com");
      case "kyobo" ->
          Set.of(
                  "www.kyobobook.co.kr",
                  "search.kyobobook.co.kr",
                  "product.kyobobook.co.kr",
                  "contents.kyobobook.co.kr")
              .contains(host);
      case "yes24" -> Set.of("www.yes24.com", "www.yes24.co.kr", "image.yes24.com").contains(host);
      default -> false;
    };
  }

  private static boolean allowedPath(String source, String host, String path) {
    if (path.equals("/robots.txt")) return true;
    return switch (source) {
      case "open_library" ->
          host.equals("openlibrary.org")
              ? path.equals("/search.json")
                  || path.matches("/books/OL[0-9]+M(\\.json)?")
                  || path.matches("/isbn/[0-9Xx-]+\\.json")
              : path.startsWith("/b/")
                  || path.startsWith("/download/")
                  || path.startsWith("/services/img/")
                  || path.startsWith("/BookReader/");
      case "google_books" ->
          path.startsWith("/books/v1/volumes")
              || path.equals("/books")
              || path.equals("/books/content");
      case "kakao_books" -> host.equals("dapi.kakao.com") ? path.equals("/v3/search/book") : true;
      case "nl_seoji" -> path.equals("/seoji/SearchApi.do") || path.startsWith("/NL/contents/");
      case "naver_books" ->
          path.startsWith("/v1/search/book")
              || host.endsWith("pstatic.net")
              || path.startsWith("/book/");
      case "goodreads" ->
          path.startsWith("/search")
              || path.startsWith("/book/show/")
              || host.equals("i.gr-assets.com")
              || host.equals("images-na.ssl-images-amazon.com");
      case "kyobo" ->
          path.startsWith("/search") || path.startsWith("/detail/") || path.startsWith("/pdt/");
      case "yes24" ->
          path.startsWith("/Product/Search")
              || path.startsWith("/Product/Goods/")
              || path.startsWith("/goods/");
      default -> false;
    };
  }

  public static boolean publicAddress(InetAddress ip) {
    if (ip.isAnyLocalAddress()
        || ip.isLoopbackAddress()
        || ip.isLinkLocalAddress()
        || ip.isSiteLocalAddress()
        || ip.isMulticastAddress()) return false;
    byte[] b = ip.getAddress();
    if (b.length == 4) {
      int a = b[0] & 255, c = b[1] & 255, d = b[2] & 255;
      return a != 0
          && a != 10
          && a != 127
          && a < 224
          && !(a == 100 && c >= 64 && c <= 127)
          && !(a == 169 && c == 254)
          && !(a == 172 && c >= 16 && c <= 31)
          && !(a == 192 && (c == 168 || c == 0 || (c == 88 && d == 99)))
          && !(a == 198 && (c == 18 || c == 19 || (c == 51 && d == 100)))
          && !(a == 203 && c == 0 && d == 113);
    }
    // Restrict IPv6 to global unicast, excluding documentation and transition/reserved prefixes.
    return (b[0] & 224) == 32
        && !((b[0] & 255) == 32
            && (b[1] & 255) == 1
            && (((b[2] & 255) == 13 && (b[3] & 255) == 184) || ((b[2] & 255) == 0)))
        && !((b[0] & 255) == 32 && (b[1] & 255) == 2);
  }
}
