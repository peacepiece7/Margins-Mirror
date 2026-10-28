package com.margins.book.catalog.provider;

import com.margins.book.catalog.business.CatalogText;
import java.util.*;

/** Edition-level, normalized allowlisted payload. Work identifiers are not accepted as editions. */
public record NormalizedBook(
    String externalId,
    String sourceUrl,
    String title,
    String subtitle,
    List<String> authors,
    String isbn13,
    String publisher,
    String publishedDate,
    String language,
    String format,
    Integer pageCount,
    String description,
    String coverUrl,
    String editionStatement,
    List<Contributor> contributors,
    String setIsbn13,
    String plannedPublicationDate) {
  public record Contributor(String name, String role) {
    public Contributor {
      name = CatalogText.plain(name, 120);
      role =
          Set.of("AUTHOR", "TRANSLATOR", "EDITOR", "ILLUSTRATOR")
                  .contains(Objects.requireNonNullElse(role, ""))
              ? role
              : "OTHER";
    }
  }

  public NormalizedBook(
      String externalId,
      String sourceUrl,
      String title,
      String subtitle,
      List<String> authors,
      String isbn13,
      String publisher,
      String publishedDate,
      String language,
      String format,
      Integer pageCount,
      String description,
      String coverUrl,
      String editionStatement) {
    this(
        externalId,
        sourceUrl,
        title,
        subtitle,
        authors,
        isbn13,
        publisher,
        publishedDate,
        language,
        format,
        pageCount,
        description,
        coverUrl,
        editionStatement,
        null,
        null,
        null);
  }

  public NormalizedBook {
    externalId = CatalogText.plain(externalId, 255);
    title = CatalogText.plain(title, 255);
    sourceUrl = sourceUrl == null ? "" : sourceUrl.strip();
    if (externalId.isBlank() || title.isBlank() || sourceUrl.length() > 1000)
      throw new SourceFailure("INVALID_RESPONSE");
    subtitle = CatalogText.optional(subtitle, 255);
    authors =
        authors == null
            ? List.of()
            : authors.stream()
                .limit(30)
                .map(s -> CatalogText.plain(s, 120))
                .filter(s -> !s.isBlank())
                .toList();
    isbn13 = CatalogText.isbn13(isbn13);
    publisher = CatalogText.optional(publisher, 255);
    publishedDate = validDate(publishedDate);
    language =
        switch (Objects.requireNonNullElse(language, "").toLowerCase(Locale.ROOT)) {
          case "kor", "ko", "korean" -> "ko";
          case "eng", "en", "english" -> "en";
          default -> CatalogText.optional(language, 16);
        };
    format =
        Set.of("PRINT", "EBOOK", "AUDIOBOOK").contains(Objects.requireNonNullElse(format, ""))
            ? format
            : "UNKNOWN";
    pageCount = pageCount != null && pageCount > 0 && pageCount < 1000000 ? pageCount : null;
    description = CatalogText.optional(description, 2000);
    coverUrl = coverUrl != null && coverUrl.length() <= 1000 ? coverUrl : null;
    editionStatement = CatalogText.optional(editionStatement, 255);
    contributors =
        contributors == null
            ? authors.stream().map(a -> new Contributor(a, "AUTHOR")).toList()
            : contributors.stream().limit(60).filter(c -> !c.name().isBlank()).toList();
    setIsbn13 = CatalogText.isbn13(setIsbn13);
    if (plannedPublicationDate != null && plannedPublicationDate.matches("\\d{8}"))
      plannedPublicationDate =
          plannedPublicationDate.substring(0, 4)
              + "-"
              + plannedPublicationDate.substring(4, 6)
              + "-"
              + plannedPublicationDate.substring(6);
    plannedPublicationDate = validDate(plannedPublicationDate);
  }

  public String author() {
    return CatalogText.plain(String.join(", ", authors), 255);
  }

  public NormalizedBook withSupplement(
      List<Contributor> contributors, String setIsbn, String planned) {
    return new NormalizedBook(
        externalId,
        sourceUrl,
        title,
        subtitle,
        authors,
        isbn13,
        publisher,
        publishedDate,
        language,
        format,
        pageCount,
        description,
        coverUrl,
        editionStatement,
        contributors,
        setIsbn,
        planned);
  }

  static String validDate(String value) {
    if (value == null) return null;
    if (!value.matches("\\d{4}(-\\d{2}){0,2}")) {
      try {
        return java.time.LocalDate.parse(
                value, java.time.format.DateTimeFormatter.ofPattern("MMMM d, uuuu", Locale.ENGLISH))
            .toString();
      } catch (java.time.DateTimeException ignored) {
      }
      try {
        return java.time.YearMonth.parse(
                value, java.time.format.DateTimeFormatter.ofPattern("MMMM uuuu", Locale.ENGLISH))
            .toString();
      } catch (java.time.DateTimeException ignored) {
        return null;
      }
    }
    try {
      if (value.length() == 4) java.time.Year.parse(value);
      else if (value.length() == 7) java.time.YearMonth.parse(value);
      else java.time.LocalDate.parse(value);
      return value.startsWith("0000") ? null : value;
    } catch (java.time.DateTimeException ex) {
      return null;
    }
  }
}
