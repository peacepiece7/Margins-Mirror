package com.margins.book.catalog.business;

import com.margins.book.catalog.mapper.*;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Bounded incremental cleanup. Live reads already reject invalid origins before this sweep. */
@Component
@RequiredArgsConstructor
public class CatalogRetentionBusiness {
  private final CatalogBookMapper books;
  private final CatalogLibraryMapper library;
  private final CatalogProjection projection;
  private final CatalogTime time;
  private final TransactionTemplate tx;
  private long after;

  public synchronized void maintain() {
    library.scrubExpiredCopies(time.now());
    books.expirePayloads(time.now());
    var page = books.maintenancePage(after);
    for (var candidate : page) {
      tx.executeWithoutResult(
          status -> {
            var book = books.lockBook(candidate.getId());
            if (book == null) return;
            var resolved = projection.resolve(List.of(book), time.now()).get(book.getId());
            if (resolved != null && "ACTIVE".equals(book.getStatus())) {
              projection.write(book, resolved, time.now());
            } else if (resolved == null) {
              // Retain only stable identity/FKs, never an expired descriptive projection.
              book.setTitle("[unavailable]");
              book.setTitleNormalized("");
              book.setAuthorsDisplay("");
              book.setAuthorsNormalized("");
              book.setSubtitle(null);
              book.setPublisher(null);
              book.setPublishedDateText(null);
              book.setLanguageCode(null);
              book.setFormat("UNKNOWN");
              book.setPageCount(null);
              book.setDescription(null);
              book.setFieldProvenance("{}");
              book.setMetadataCheckedAt(time.now());
              books.project(book);
            }
          });
      after = candidate.getId();
    }
    if (page.size() < 100) after = 0;
  }
}
