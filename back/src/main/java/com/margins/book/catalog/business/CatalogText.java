package com.margins.book.catalog.business;

import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.text.Normalizer;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.jsoup.Jsoup;

/** Stable v1 keyword identity; filters and provider/ranking settings must never enter the HMAC. */
public final class CatalogText {
  private CatalogText() {}

  public record Command(
      String keyword,
      String isbn13,
      Field field,
      String language,
      Format format,
      int limit,
      Intent intent) {}

  public static Command command(SearchRequest request) {
    String text = request.query() == null ? "" : request.query().strip();
    Field field = request.field();
    if (field == Field.ALL) {
      var matcher =
          java.util.regex.Pattern.compile(
                  "^(title|intitle|author|inauthor|isbn):\\s*(.+)$",
                  java.util.regex.Pattern.CASE_INSENSITIVE)
              .matcher(text);
      if (matcher.matches()) {
        String prefix = matcher.group(1).toLowerCase(Locale.ROOT);
        field =
            prefix.contains("title")
                ? Field.TITLE
                : prefix.contains("author") ? Field.AUTHOR : Field.ISBN;
        text = matcher.group(2);
      }
    }
    String keyword = normalize(text);
    if (keyword.isBlank()
        || keyword.codePointCount(0, keyword.length()) > 200
        || keyword.codePoints().anyMatch(Character::isISOControl)) throw invalid();
    String isbn = isbn13(keyword);
    if (field == Field.ISBN && isbn == null) throw invalid();
    if (isbn != null) {
      keyword = isbn;
      if (field == Field.ALL) field = Field.ISBN;
    }
    if (request.limit() < 1
        || request.limit() > 40
        || !Set.of("ALL", "ko", "en").contains(request.language())) throw invalid();
    return new Command(
        keyword,
        isbn,
        field,
        request.language(),
        request.format(),
        request.limit(),
        request.intent());
  }

  public static String normalize(String value) {
    return Normalizer.normalize(Objects.requireNonNullElse(value, ""), Normalizer.Form.NFKC)
        .replaceAll("[\\p{Z}\\s]+", " ")
        .strip()
        .toLowerCase(Locale.ROOT);
  }

  public static String plain(String value, int maxCodePoints) {
    String text = Jsoup.parse(Objects.requireNonNullElse(value, "")).text().strip();
    return text.codePointCount(0, text.length()) <= maxCodePoints
        ? text
        : text.substring(0, text.offsetByCodePoints(0, maxCodePoints));
  }

  public static String optional(String value, int max) {
    String text = plain(value, max);
    return text.isBlank() ? null : text;
  }

  public static String isbn13(String input) {
    if (input == null) return null;
    String text = input.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    if (text.matches("[0-9]{9}[0-9X]")) {
      int sum = 0;
      for (int i = 0; i < 10; i++)
        sum += (10 - i) * (text.charAt(i) == 'X' ? 10 : text.charAt(i) - '0');
      if (sum % 11 != 0) return null;
      String base = "978" + text.substring(0, 9);
      return base + isbn13Check(base);
    }
    if (!text.matches("97[89][0-9]{10}")) return null;
    return isbn13Check(text.substring(0, 12)) == text.charAt(12) - '0' ? text : null;
  }

  private static int isbn13Check(String text) {
    int sum = 0;
    for (int i = 0; i < 12; i++) sum += (text.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
    return (10 - sum % 10) % 10;
  }

  public static byte[] hash(String text) {
    return hash(text.getBytes(StandardCharsets.UTF_8));
  }

  public static byte[] hash(byte[] bytes) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(bytes);
    } catch (GeneralSecurityException ex) {
      throw new IllegalStateException("SHA-256 unavailable");
    }
  }

  public static byte[] key(byte[] secret, String keyword) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return mac.doFinal(("catalog-keyword-v1:" + keyword).getBytes(StandardCharsets.UTF_8));
    } catch (GeneralSecurityException ex) {
      throw new IllegalStateException("HMAC unavailable");
    }
  }

  public static String hex(byte[] bytes) {
    return HexFormat.of().formatHex(bytes);
  }

  private static ApiException invalid() {
    return new ApiException(ApiErrorCode.COMMON_VALIDATION_FAILED);
  }
}
