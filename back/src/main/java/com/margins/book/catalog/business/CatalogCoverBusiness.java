package com.margins.book.catalog.business;

import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
public class CatalogCoverBusiness {
  private final CatalogCoverMapper covers;
  private final CatalogBookMapper books;
  private final CatalogLibraryMapper library;
  private final CatalogSourceMapper sources;
  private final CatalogCollectionBusiness collection;
  private final CatalogTime time;
  private final TransactionTemplate tx;

  public void store(Job claimed, String sourceUrl, CatalogCoverProcessor.Image image) {
    tx.executeWithoutResult(
        status -> {
          Job job = collection.fence(claimed);
          if (job == null) return;
          Source source = sources.lock(job.getSourceId());
          SourceRecord record = books.recordId(job.getSourceRecordId());
          var now = time.now();
          if (record == null
              || !CatalogSourceRegistry.allowed(source, now, true)
              || !"ACTIVE".equals(record.getStatus())
              || record.getPolicyVersion() != source.getPolicyVersion()
              || (record.getExpiresAt() != null && !record.getExpiresAt().isAfter(now))) {
            collection.finish(job, "CANCELLED", "POLICY_DENIED");
            return;
          }
          CatalogUrlPolicy.validate(source.getCode(), java.net.URI.create(sourceUrl));
          Budget budget = covers.lockBudget();
          byte[] sha = CatalogText.hash(image.bytes());
          Cover existing = covers.same(record.getId(), sha);
          if (existing != null && existing.getStatus().equals("WITHDRAWN")) {
            books.coverStatus(record.getId(), "DENIED");
            collection.finish(job, "CANCELLED", "POLICY_DENIED");
            return;
          }
          int delta =
              existing != null && existing.getStatus().equals("READY") ? 0 : image.bytes().length;
          if (budget.getUsedBytes() + delta > budget.getLimitBytes()) {
            books.coverStatus(record.getId(), "FAILED");
            collection.finish(job, "FAILED", "STORAGE_BUDGET_EXCEEDED");
            return;
          }
          Cover cover = existing == null ? new Cover() : existing;
          cover.setSourceRecordId(record.getId());
          cover.setSha256(sha);
          cover.setSourceUrl(sourceUrl);
          cover.setMimeType(image.mime());
          cover.setWidth(image.width());
          cover.setHeight(image.height());
          cover.setByteSize(image.bytes().length);
          cover.setImageBytes(image.bytes());
          cover.setStatus("READY");
          cover.setPolicyVersion(source.getPolicyVersion());
          cover.setFetchedAt(now);
          cover.setExpiresAt(
              source.getCoverTtlSeconds() == null
                  ? null
                  : now.plusSeconds(source.getCoverTtlSeconds()));
          cover.setTestData(job.isTestData());
          if (existing == null) covers.insert(cover);
          else covers.restore(cover);
          covers.budgetBytes(budget.getUsedBytes() + delta);
          books.cover(record.getCatalogBookId(), cover.getId());
          library.cover(record.getCatalogBookId(), CatalogProjection.coverPath(cover));
          books.coverStatus(record.getId(), "READY");
          collection.finish(job, "SUCCEEDED", null);
        });
  }

  public void withdraw(long id, boolean permanent) {
    tx.executeWithoutResult(
        status -> {
          Budget budget = covers.lockBudget();
          Cover cover = covers.metadata(id);
          if (cover == null) return;
          long delta = covers.storedSize(id);
          covers.release(id, permanent ? "WITHDRAWN" : "EXPIRED");
          covers.clearPointer(id);
          library.clearCover(id);
          covers.budgetBytes(budget.getUsedBytes() - delta);
        });
  }

  public void maintain() {
    for (long id : covers.expired(time.now(), time.now().minusDays(7))) withdraw(id, false);
  }
}
