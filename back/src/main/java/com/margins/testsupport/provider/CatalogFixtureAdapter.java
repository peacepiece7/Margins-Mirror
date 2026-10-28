package com.margins.testsupport.provider;

import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.model.CatalogRows.Source;
import com.margins.book.catalog.provider.*;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Local E2E only. Exercises the real worker/transactions without changing the production HTTP
 * allowlist.
 */
@Component
@Profile("local")
@Order(-100)
@ConditionalOnProperty(name = "margins.test-support.catalog-fixture-enabled", havingValue = "true")
public class CatalogFixtureAdapter implements CatalogAdapter {
  public CatalogFixtureAdapter(CatalogProperties properties) {
    if (!properties.isTestData())
      throw new IllegalStateException("Catalog fixture requires test-owned catalog data");
  }

  @Override
  public boolean supports(String code) {
    return code.equals("open_library");
  }

  @Override
  public Result search(Source source, String keyword) {
    if (!source.isTestData()) throw new SourceFailure("BLOCKED");
    if (!keyword.toLowerCase(java.util.Locale.ROOT).contains("dune")
        && !keyword.equals("9780425038918")) return new Result(List.of(), false);
    return new Result(
        List.of(
            new NormalizedBook(
                "/books/OL7500941M",
                "https://openlibrary.org/books/OL7500941M",
                "Dune",
                null,
                List.of("Frank Herbert"),
                "9780425038918",
                "Berkley",
                "1978",
                "en",
                "PRINT",
                null,
                null,
                null,
                null)),
        false);
  }
}
