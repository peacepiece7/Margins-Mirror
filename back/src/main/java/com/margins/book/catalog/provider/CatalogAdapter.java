package com.margins.book.catalog.provider;

import com.margins.book.catalog.model.CatalogRows.Source;
import java.util.List;

public interface CatalogAdapter {
  record Result(List<NormalizedBook> records, boolean hasMore) {}

  boolean supports(String code);

  Result search(Source source, String keyword);

  default Result search(Source source, String keyword, int page) {
    if (page != 1) throw new SourceFailure("INVALID_PAGE");
    return search(source, keyword);
  }
}
