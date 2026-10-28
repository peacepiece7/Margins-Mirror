package com.margins.book.catalog.service;

import com.margins.book.catalog.business.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.util.*;
import java.util.concurrent.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(
    prefix = "margins.catalog",
    name = "worker-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class CatalogWorker {
  private final CatalogCollectionBusiness collection;
  private final CatalogSearchMapper queries;
  private final CatalogSourceMapper sources;
  private final CatalogJobMapper jobs;
  private final CatalogBookMapper books;
  private final CatalogCoverBusiness covers;
  private final CatalogCoverProcessor processor;
  private final CatalogHttpClient http;
  private final CatalogJson json;
  private final CatalogTime time;
  private final CatalogRetentionBusiness retention;
  private final List<CatalogAdapter> adapters;
  private final ExecutorService workers =
      Executors.newFixedThreadPool(
          2,
          r -> {
            var t = new Thread(r, "catalog-worker");
            t.setDaemon(true);
            return t;
          });
  private final ScheduledExecutorService heartbeats =
      Executors.newSingleThreadScheduledExecutor(
          r -> {
            var t = new Thread(r, "catalog-heartbeat");
            t.setDaemon(true);
            return t;
          });
  private final Semaphore slots = new Semaphore(2);

  @Scheduled(fixedDelay = 1000, initialDelay = 10000)
  public void tick() {
    collection.recover();
    while (slots.tryAcquire()) {
      Job job;
      try {
        job = collection.claim();
      } catch (RuntimeException ex) {
        slots.release();
        return;
      }
      if (job == null) {
        slots.release();
        return;
      }
      workers.submit(
          () -> {
            try {
              run(job);
            } finally {
              slots.release();
            }
          });
    }
  }

  private void run(Job job) {
    var heartbeat =
        heartbeats.scheduleAtFixedRate(
            () ->
                jobs.heartbeat(
                    job.getId(), job.getLeaseToken(), time.now(), time.now().plusSeconds(60)),
            15,
            15,
            TimeUnit.SECONDS);
    try {
      var source = sources.source(job.getSourceId());
      if (!CatalogSourceRegistry.allowed(source, time.now(), job.getKind().equals("FETCH_COVER")))
        throw new SourceFailure("BLOCKED");
      if (job.getKind().equals("SEARCH")) {
        var query = queries.find(job.getQueryEntryId());
        if (query == null || query.getQueryText() == null) throw new SourceFailure("QUERY_EXPIRED");
        var adapter =
            adapters.stream()
                .filter(a -> a.supports(source.getCode()))
                .findFirst()
                .orElseThrow(() -> new SourceFailure("NOT_CONFIGURED"));
        collection.success(job, adapter.search(source, query.getQueryText(), job.getPageNumber()));
      } else {
        var record = books.recordId(job.getSourceRecordId());
        if (record == null) throw new SourceFailure("NOT_FOUND");
        var data = json.read(record.getNormalizedPayload(), NormalizedBook.class);
        if (data.coverUrl() == null) throw new SourceFailure("NOT_FOUND");
        var response =
            http.get(source, URI.create(data.coverUrl()), Map.of(), true, 5 * 1024 * 1024);
        if (response.status() != 200) throw new SourceFailure("NOT_FOUND");
        covers.store(job, data.coverUrl(), processor.minimize(response.body()));
      }
    } catch (SourceFailure ex) {
      log.warn(
          "Catalog job {}. jobId={}, sourceId={}, code={}",
          ex.localDeferral() ? "deferred" : "failed",
          job.getId(),
          job.getSourceId(),
          ex.code());
      collection.failure(job, ex);
    } catch (RuntimeException ex) {
      log.warn(
          "Catalog job failed. jobId={}, sourceId={}, code=INTERNAL_ERROR, type={}",
          job.getId(),
          job.getSourceId(),
          ex.getClass().getSimpleName());
      collection.failure(job, new SourceFailure("INTERNAL_ERROR"));
    } finally {
      heartbeat.cancel(false);
    }
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 30000)
  public void maintain() {
    queries.clearText(time.now());
    queries.purgeSnapshots(time.now());
    jobs.purge(time.now().minusHours(24));
    queries.purgeQueries(time.now());
    covers.maintain();
    retention.maintain();
  }

  @PreDestroy
  public void close() {
    workers.shutdownNow();
    heartbeats.shutdownNow();
  }
}
