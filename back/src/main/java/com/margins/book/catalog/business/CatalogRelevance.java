package com.margins.book.catalog.business;

import com.margins.book.catalog.dto.CatalogDto.Format;
import com.margins.book.catalog.provider.NormalizedBook;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/** ngram generates candidates, not proof that an arbitrary local book matches the keyword. */
public final class CatalogRelevance {
  private CatalogRelevance() {}

  public enum Match {
    ISBN,
    EXACT,
    ALIAS,
    TOKEN,
    PROVIDER,
    NONE
  }

  private static final List<String> WEIR = List.of("andyweir", "앤디위어", "엔디위어");

  private static String compact(String text) {
    return CatalogText.normalize(text).replaceAll("[^\\p{L}\\p{N}]+", "");
  }

  public static Match match(NormalizedBook book, CatalogText.Command command, boolean providerHit) {
    if (!command.language().equals("ALL") && !command.language().equals(book.language()))
      return Match.NONE;
    if (command.format() != Format.ALL && !command.format().name().equals(book.format()))
      return Match.NONE;
    if (command.isbn13() != null && command.isbn13().equals(book.isbn13())) return Match.ISBN;
    if (command.field() == com.margins.book.catalog.dto.CatalogDto.Field.ISBN) return Match.NONE;
    boolean title = command.field() != com.margins.book.catalog.dto.CatalogDto.Field.AUTHOR;
    boolean author = command.field() != com.margins.book.catalog.dto.CatalogDto.Field.TITLE;
    String q = compact(command.keyword());
    String fullTitle = book.title() + " " + Objects.requireNonNullElse(book.subtitle(), "");
    if ((title && compact(fullTitle).equals(q)) || (author && compact(book.author()).equals(q)))
      return Match.EXACT;
    if (author
        && WEIR.contains(q)
        && WEIR.stream()
            .anyMatch(
                alias ->
                    compact(book.author()).equals(alias)
                        || compact(book.author()).equals(alias + "andyweir"))) return Match.ALIAS;
    String text =
        (title ? book.title() + " " + Objects.requireNonNullElse(book.subtitle(), "") : "")
            + " "
            + (author ? book.author() : "");
    if (textMatches(text, command.keyword())) return Match.TOKEN;
    return providerHit && command.field() == com.margins.book.catalog.dto.CatalogDto.Field.ALL
        ? Match.PROVIDER
        : Match.NONE;
  }

  public static boolean matches(
      NormalizedBook book, CatalogText.Command command, boolean providerHit) {
    return match(book, command, providerHit) != Match.NONE;
  }

  /**
   * Local candidate lookup variants only; collection identity and provider keyword stay unchanged.
   */
  public static List<String> lookupKeywords(String keyword) {
    return WEIR.contains(compact(keyword))
        ? List.of(keyword, "앤디 위어", "앤디위어", "Andy Weir")
        : List.of(keyword);
  }

  static boolean textMatches(String text, String keyword) {
    String normalized = CatalogText.normalize(text);
    List<String> queryTokens = tokens(keyword), textTokens = tokens(normalized);
    if (queryTokens.isEmpty()) return normalized.contains(keyword);
    String compact = String.join("", textTokens);
    if (keyword
            .codePoints()
            .anyMatch(c -> Character.UnicodeScript.of(c) == Character.UnicodeScript.HANGUL)
        && compact.contains(String.join("", queryTokens))) return true;
    return queryTokens.stream()
        .allMatch(q -> textTokens.stream().anyMatch(word -> word.startsWith(q)));
  }

  private static List<String> tokens(String text) {
    return Arrays.stream(text.split("[^\\p{L}\\p{N}]+")).filter(s -> !s.isEmpty()).toList();
  }
}
