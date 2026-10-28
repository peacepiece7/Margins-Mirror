package com.margins.book.catalog.business;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Short database transactions; adapters never execute under these locks. */
@Component
@RequiredArgsConstructor
public class CatalogCollectionBusiness {
  private final CatalogSearchMapper queries;
  private final CatalogJobMapper jobs;
  private final CatalogBookMapper books;
  private final CatalogSourceMapper sources;
  private final CatalogSourceRegistry registry;
  private final CatalogIngestBusiness ingest;
  private final CatalogProperties properties;
  private final CatalogJson json;
  private final ObjectMapper objectMapper;
  private final CatalogTime time;
  private final TransactionTemplate tx;
  private final CatalogAdmission admission;
  private final CatalogResultMapper results;

  public record Outcome(String state, List<Long> ids, boolean more, boolean html) {}

  public static boolean active(Job job) {
    return Set.of("QUEUED", "RUNNING", "RETRY").contains(job.getState());
  }

  public Map<String, Outcome> outcomes(Query query) {
    try {
      return new LinkedHashMap<>(
          objectMapper.readValue(
              query.getSourceOutcomes(), new TypeReference<Map<String, Outcome>>() {}));
    } catch (Exception ex) {
      throw new IllegalStateException("Invalid catalog outcome state");
    }
  }

  public Query submit(CatalogText.Command command) {
    return submit(command, null);
  }

  public Query submit(CatalogText.Command command, Long userId) {
    registry.initialize();
    return tx.execute(
        status -> {
          var now = time.now();
          Query initial = new Query();
          initial.setPublicId(UUID.randomUUID().toString());
          initial.setQueryKey(CatalogText.key(queries.hmacKey(), command.keyword()));
          initial.setRetireAfter(now.plusDays(31));
          initial.setTestData(properties.isTestData());
          queries.insertQuery(initial);
          Query query = queries.lockKey(initial.getQueryKey(), initial.isTestData());
          if (command.intent() == Intent.REBUILD || !properties.isEnabled()) return query;
          // Use the locked row, not an older REPEATABLE READ snapshot of the jobs table.
          boolean collecting =
              outcomes(query).values().stream()
                  .anyMatch(outcome -> Set.of("PENDING", "WAITING").contains(outcome.state()));
          if (command.intent() == Intent.EXTEND) {
            if (collecting || !canExtend(query)) return query;
            if (userId != null) admission.admit(userId, now);
            var outcomes = outcomes(query);
            for (var page : results.pages(query.getId(), query.getGeneration())) {
              Source source = sources.source(page.sourceId());
              if (!page.hasMore()
                  || page.completedPage() >= 5
                  || source == null
                  || !CatalogSourceRegistry.allowed(source, now, false)
                  || !extendableSource(source.getCode())) continue;
              var previous = outcomes.get(source.getCode());
              if (previous == null) continue;
              outcomes.put(source.getCode(), new Outcome("PENDING", previous.ids(), true, false));
              enqueue(query, source, now, page.completedPage() + 1);
            }
            query.setSourceOutcomes(json.write(outcomes));
            queries.update(query);
            return query;
          }
          if (collecting
              || (query.getRevalidateAfter() != null && query.getRevalidateAfter().isAfter(now))
              || (query.getRetryAfter() != null && query.getRetryAfter().isAfter(now)))
            return query;
          if (userId != null) {
            try {
              admission.admit(userId, now);
            } catch (CatalogRateLimitException ex) {
              if (json.ids(query.getCachedBookIds()).isEmpty()) throw ex;
              query.setLastOutcome("DEFERRED");
              return query;
            }
          }
          query.setGeneration(query.getGeneration() + 1);
          query.setResultVersion(query.getResultVersion() + 1);
          query.setQueryText(command.keyword());
          query.setTextExpiresAt(now.plusHours(24));
          query.setRetryAfter(null);
          Map<String, Outcome> outcomes = new LinkedHashMap<>();
          List<Source> eligible =
              registry.sources().stream()
                  .filter(s -> CatalogSourceRegistry.allowed(s, now, false))
                  .toList();
          boolean hasApi = eligible.stream().anyMatch(s -> s.getAdapterType().equals("API"));
          for (var source : eligible) {
            boolean html = source.getAdapterType().equals("HTML");
            outcomes.put(
                source.getCode(),
                new Outcome(html && hasApi ? "WAITING" : "PENDING", List.of(), false, html));
            if (!html || !hasApi) enqueue(query, source, now);
          }
          query.setSourceOutcomes(json.write(outcomes));
          query.setRetireAfter(now.plusDays(31));
          if (eligible.isEmpty()) {
            query.setLastOutcome("DEFERRED");
            query.setRetryAfter(now.plusMinutes(1));
          }
          queries.update(query);
          return query;
        });
  }

  private void enqueue(Query query, Source source, LocalDateTime now) {
    enqueue(query, source, now, 1);
  }

  private void enqueue(Query query, Source source, LocalDateTime now, int page) {
    Job job = new Job();
    job.setQueryEntryId(query.getId());
    job.setSourceId(source.getId());
    job.setGeneration(query.getGeneration());
    job.setKind("SEARCH");
    job.setPageNumber(page);
    job.setDedupeKey(
        CatalogText.hash(
            "search:"
                + query.getId()
                + ":"
                + query.getGeneration()
                + ":"
                + source.getId()
                + ":"
                + page));
    job.setAvailableAt(now);
    job.setDeadlineAt(
        now.plusMinutes(10).isBefore(query.getTextExpiresAt())
            ? now.plusMinutes(10)
            : query.getTextExpiresAt());
    job.setTestData(query.isTestData());
    jobs.insert(job);
  }

  public Job claim() {
    registry.initialize();
    return tx.execute(
        status -> {
          var now = time.now();
          Job job = jobs.claimable(now);
          if (job == null) return null;
          job.setState("RUNNING");
          job.setAttemptCount(job.getAttemptCount() + 1);
          job.setLeaseToken(UUID.randomUUID().toString());
          job.setLeaseUntil(now.plusSeconds(60));
          jobs.update(job);
          return job;
        });
  }

  /** Caller owns the transaction. Locks always follow query -> job -> source. */
  public Job fence(Job claimed) {
    Query query = queries.lock(claimed.getQueryEntryId());
    Job current = jobs.lock(claimed.getId());
    var now = time.now();
    if (query == null
        || current == null
        || query.getGeneration() != claimed.getGeneration()
        || !"RUNNING".equals(current.getState())
        || !Objects.equals(current.getLeaseToken(), claimed.getLeaseToken())
        || !current.getLeaseUntil().isAfter(now)
        || !current.getDeadlineAt().isAfter(now)) return null;
    return current;
  }

  public void success(Job claimed, CatalogAdapter.Result result) {
    tx.executeWithoutResult(
        status -> {
          Job job = fence(claimed);
          if (job == null) return;
          Source source = sources.lock(job.getSourceId());
          if (!CatalogSourceRegistry.allowed(source, time.now(), false)) {
            finish(job, "CANCELLED", "SOURCE_PAUSED");
            aggregate(job);
            return;
          }
          Set<Long> ids = new LinkedHashSet<>();
          int rank = (job.getPageNumber() - 1) * 20;
          for (var data : result.records().stream().limit(20).toList()) {
            long id = ingest.upsert(source, data, job, time.now());
            if (id > 0) {
              ids.add(id);
              results.hit(
                  job.getQueryEntryId(),
                  job.getGeneration(),
                  source.getId(),
                  id,
                  rank,
                  job.isTestData());
            }
            rank++;
          }
          Query query = queries.lock(job.getQueryEntryId());
          var outcomes = outcomes(query);
          if (job.getPageNumber() > 1 && outcomes.containsKey(source.getCode())) {
            Set<Long> combined = new LinkedHashSet<>(outcomes.get(source.getCode()).ids());
            combined.addAll(ids);
            ids = combined;
          }
          results.progress(
              query.getId(),
              query.getGeneration(),
              source.getId(),
              job.getPageNumber(),
              result.hasMore(),
              query.isTestData());
          outcomes.put(
              source.getCode(),
              new Outcome(
                  ids.isEmpty() ? "EMPTY" : "SUCCEEDED",
                  List.copyOf(ids),
                  result.hasMore(),
                  source.getAdapterType().equals("HTML")));
          query.setSourceOutcomes(json.write(outcomes));
          queries.update(query);
          sources.success(source.getId());
          finish(job, "SUCCEEDED", null);
          aggregate(job);
        });
  }

  public void failure(Job claimed, SourceFailure error) {
    tx.executeWithoutResult(
        status -> {
          Job job = fence(claimed);
          if (job == null) return;
          var now = time.now();
          Source source = sources.lock(job.getSourceId());
          int delay = error.retryAfterSeconds();
          // Claim reserves an attempt; quota/backoff refusal never performed that attempt.
          if (error.localDeferral()) job.setAttemptCount(Math.max(0, job.getAttemptCount() - 1));
          boolean retry =
              Set.of("TIMEOUT", "UPSTREAM_ERROR", "RATE_LIMITED").contains(error.code())
                  && job.getAttemptCount() < 3
                  && now.plusSeconds(delay).isBefore(job.getDeadlineAt());
          if (!error.localDeferral() && source != null && job.getKind().equals("SEARCH")) {
            sources.failure(
                source.getId(),
                now.plusSeconds(
                    source.getConsecutiveFailures() >= 4 ? Math.max(600, delay) : delay));
            if ("BLOCKED".equals(error.code())) sources.status(source.getId(), "PAUSED");
          }
          if (retry) {
            job.setState("RETRY");
            job.setAvailableAt(
                now.plusSeconds(
                    error.localDeferral()
                        ? delay
                        : Math.max(delay, job.getAttemptCount() == 1 ? 5 : 30)));
            job.setLeaseToken(null);
            job.setLeaseUntil(null);
            job.setSafeErrorCode(error.code());
            jobs.update(job);
          } else {
            finish(job, "FAILED", error.code());
            if (job.getKind().equals("SEARCH")) aggregate(job);
          }
        });
  }

  public void finish(Job job, String state, String error) {
    if (job.getKind().equals("FETCH_COVER") && job.getSourceRecordId() != null) {
      books.coverStatus(
          job.getSourceRecordId(),
          state.equals("SUCCEEDED")
              ? "READY"
              : state.equals("CANCELLED")
                      || Set.of("BLOCKED", "POLICY_DENIED").contains(error == null ? "" : error)
                  ? "DENIED"
                  : "FAILED");
      queries.bumpCoverVersion(job.getQueryEntryId());
    }
    job.setState(state);
    job.setSafeErrorCode(error);
    job.setFinishedAt(time.now());
    job.setLeaseToken(null);
    job.setLeaseUntil(null);
    jobs.update(job);
  }

  private void aggregate(Job completed) {
    Query query = queries.lock(completed.getQueryEntryId());
    if (query == null || query.getGeneration() != completed.getGeneration()) return;
    var outcomes = outcomes(query);
    var now = time.now();
    var generation =
        jobs.generation(query.getId(), query.getGeneration()).stream()
            .filter(j -> j.getKind().equals("SEARCH"))
            .toList();
    for (var job : generation) {
      Source source = sources.source(job.getSourceId());
      if (source == null) continue;
      var previous = outcomes.get(source.getCode());
      if (!active(job) && !job.getState().equals("SUCCEEDED")) {
        outcomes.put(
            source.getCode(),
            new Outcome(
                "FAILED",
                previous == null ? List.of() : previous.ids(),
                false,
                source.getAdapterType().equals("HTML")));
        if (job.getPageNumber() > 1)
          results.progress(
              query.getId(),
              query.getGeneration(),
              source.getId(),
              job.getPageNumber() - 1,
              false,
              query.isTestData());
      } else if (previous == null)
        outcomes.put(source.getCode(), new Outcome("PENDING", List.of(), false, false));
    }
    Set<Long> newIds = new LinkedHashSet<>();
    outcomes.values().forEach(o -> newIds.addAll(o.ids()));
    boolean apiPending =
        outcomes.values().stream().anyMatch(o -> !o.html() && o.state().equals("PENDING"));
    if (!apiPending) {
      for (var source : registry.sources()) {
        Outcome o = outcomes.get(source.getCode());
        if (o == null || !o.state().equals("WAITING")) continue;
        if (newIds.size() < 20 && CatalogSourceRegistry.allowed(source, now, false)) {
          enqueue(query, source, now);
          outcomes.put(source.getCode(), new Outcome("PENDING", List.of(), false, true));
        } else outcomes.put(source.getCode(), new Outcome("SKIPPED", List.of(), false, true));
      }
    }
    boolean pending =
        outcomes.values().stream().anyMatch(o -> Set.of("PENDING", "WAITING").contains(o.state()));
    Set<Long> combined = new LinkedHashSet<>(newIds);
    // Previously cached results remain visible when only some sources have replied or failed.
    if (pending || outcomes.values().stream().anyMatch(o -> o.state().equals("FAILED")))
      combined.addAll(json.ids(query.getCachedBookIds()));
    query.setCachedBookIds(json.write(combined.stream().limit(200).toList()));
    query.setSourceOutcomes(json.write(outcomes));
    query.setResultVersion(query.getResultVersion() + 1);
    if (!pending) {
      boolean failed = outcomes.values().stream().anyMatch(o -> o.state().equals("FAILED"));
      boolean completedNormally =
          outcomes.values().stream()
              .anyMatch(o -> Set.of("SUCCEEDED", "EMPTY").contains(o.state()));
      boolean fresh = !newIds.isEmpty() || (!failed && completedNormally);
      query.setLastOutcome(fresh ? (failed ? "PARTIAL" : "SUCCEEDED") : "FAILED");
      if (fresh && completed.getPageNumber() == 1) {
        query.setLastCollectedAt(now);
        query.setRevalidateAfter(now.plusDays(30));
        query.setRetryAfter(null);
      } else if (!fresh) query.setRetryAfter(now.plusMinutes(1));
      query.setRetireAfter(now.plusDays(31));
    }
    queries.update(query);
  }

  public void recover() {
    for (var expired : jobs.expired(time.now())) {
      tx.executeWithoutResult(
          status -> {
            var query = queries.lock(expired.getQueryEntryId());
            var job = jobs.lock(expired.getId());
            if (job == null || !active(job)) return;
            if (job.getDeadlineAt().isAfter(time.now())
                && !(job.getAttemptCount() >= 3
                    && job.getLeaseUntil() != null
                    && !job.getLeaseUntil().isAfter(time.now()))) return;
            finish(job, "FAILED", "DEADLINE_EXCEEDED");
            if (query != null && job.getKind().equals("SEARCH")) aggregate(job);
          });
    }
  }

  public CollectionStatus status(Query query) {
    if (query == null) return null;
    var outcomes = outcomes(query);
    boolean running =
        outcomes.values().stream().anyMatch(o -> Set.of("PENDING", "WAITING").contains(o.state()));
    int success =
        (int)
            outcomes.values().stream()
                .filter(o -> Set.of("SUCCEEDED", "EMPTY").contains(o.state()))
                .count();
    int failed = (int) outcomes.values().stream().filter(o -> o.state().equals("FAILED")).count();
    Integer retry =
        query.getRetryAfter() == null
            ? null
            : (int) Math.max(0, Duration.between(time.now(), query.getRetryAfter()).getSeconds());
    return new CollectionStatus(
        query.getPublicId(),
        running ? "COLLECTING" : "IDLE",
        query.getLastOutcome(),
        query.getGeneration(),
        query.getResultVersion(),
        query.getCoverVersion(),
        !running && canExtend(query),
        success,
        failed,
        retry,
        CatalogTime.instant(query.getLastCollectedAt()),
        CatalogTime.instant(query.getRevalidateAfter()));
  }

  private boolean extendableSource(String code) {
    return Set.of("open_library", "google_books", "kakao_books", "naver_books").contains(code);
  }

  private boolean canExtend(Query query) {
    if (query.getQueryText() == null
        || query.getTextExpiresAt() == null
        || !query.getTextExpiresAt().isAfter(time.now())) return false;
    return results.pages(query.getId(), query.getGeneration()).stream()
        .anyMatch(
            page -> {
              Source source = sources.source(page.sourceId());
              return page.hasMore()
                  && page.completedPage() < 5
                  && source != null
                  && extendableSource(source.getCode())
                  && CatalogSourceRegistry.allowed(source, time.now(), false);
            });
  }
}
