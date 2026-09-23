package com.margins;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.*;
import com.margins.auth.security.MarginsUserPrincipal;
import com.margins.book.catalog.business.*;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import com.margins.testsupport.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/** Real MySQL/ingest/search with recorded public metadata. Never calls an external provider. */
class CatalogReliabilityIntegrationTest extends AbstractMySqlIntegrationTest {
  @Autowired CatalogCollectionBusiness collection;
  @Autowired CatalogSearchBusiness search;
  @Autowired CatalogSearchMapper queries;
  @Autowired CatalogJobMapper jobs;
  @Autowired CatalogSourceMapper sources;
  @Autowired CatalogSourceRegistry registry;
  @Autowired CatalogSourceGate gate;
  @Autowired CatalogBookMapper books;
  @Autowired ObjectMapper json;
  @MockBean CatalogTime time;
  JdbcTemplate jdbc;
  LocalDateTime now;
  long sourceId;

  @BeforeEach
  void setup() throws Exception {
    jdbc = new JdbcTemplate(dataSource);
    clean();
    IntegrationSchemaSupport.resetBooksAndUsers(dataSource);
    now = LocalDateTime.of(2026, 9, 7, 0, 0);
    when(time.now()).thenAnswer(call -> now);
    registry.initialize();
    jdbc.update(
        "UPDATE catalog_sources SET status='DISABLED',backoff_until=NULL,consecutive_failures=0,"
            + "next_request_at=NULL,quota_date=NULL,requests_today=0,daily_request_limit=500,min_interval_ms=1000,"
            + "metadata_ttl_seconds=NULL,policy_expires_at=NULL,cover_policy='UNREVIEWED'");
    jdbc.update(
        "UPDATE catalog_sources SET status='ACTIVE',metadata_policy='ALLOWED',policy_version=1,"
            + "approved_fields=JSON_ARRAY('title','subtitle','authors','isbn13','publisher','publishedDate','language','format')"
            + " WHERE code='open_library' AND is_test_data=FALSE");
    sourceId =
        jdbc.queryForObject(
            "SELECT id FROM catalog_sources WHERE code='open_library' AND is_test_data=FALSE",
            Long.class);
    var principal = new MarginsUserPrincipal(1L, "fixture", "Fixture", "local");
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
  }

  @AfterEach
  void cleanup() {
    SecurityContextHolder.clearContext();
    clean();
  }

  void clean() {
    if (jdbc == null) return;
    jdbc.update("UPDATE books SET catalog_book_id=NULL");
    jdbc.update("UPDATE catalog_books SET cover_asset_id=NULL");
    for (String table :
        List.of(
            "catalog_crawl_jobs",
            "catalog_search_snapshots",
            "catalog_search_entries",
            "catalog_cover_assets",
            "catalog_book_sources",
            "catalog_books")) jdbc.update("DELETE FROM " + table);
    jdbc.update("UPDATE catalog_storage_budget SET used_bytes=0");
  }

  Query submit(String keyword) {
    return collection.submit(
        CatalogText.command(new SearchRequest(keyword, null, null, null, 20, Intent.SUBMIT)));
  }

  SearchResponse rebuild(String keyword) {
    return search.search(new SearchRequest(keyword, null, null, null, 40, Intent.REBUILD));
  }

  private NormalizedBook fixture(int id, String title, String author) {
    return new NormalizedBook(
        "/books/OL" + id + "M",
        "https://openlibrary.org/books/OL" + id + "M",
        title,
        null,
        List.of(author),
        null,
        null,
        null,
        "ko",
        "PRINT",
        null,
        null,
        null,
        null);
  }

  @Test
  void authorAliasOutranksUnrelatedProviderHitWithoutRecollecting() {
    submit("엔디 위어");
    collection.success(
        collection.claim(),
        new CatalogAdapter.Result(
            List.of(
                fixture(1, "오늘 엄마가 공부하는 이유", "이미애"),
                fixture(2, "마션", "앤디 위어 (Andy Weir)"),
                fixture(3, "아르테미스", "앤디위어")),
            false));
    assertThat(rebuild("엔디 위어").candidates())
        .extracting(Candidate::title)
        .containsExactly("마션", "아르테미스", "오늘 엄마가 공부하는 이유");
    assertThat(rebuild("엔디위어").candidates())
        .extracting(Candidate::title)
        .containsExactly("마션", "아르테미스");
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class))
        .isEqualTo(1);
  }

  @Test
  void explicitExtensionIsDeduplicatedAndOldSnapshotKeepsItsAppliedVersionAndOrder() {
    Query query = submit("paged fixture");
    var firstBooks =
        java.util.stream.IntStream.range(1, 21)
            .mapToObj(i -> fixture(i, "paged fixture " + i, "Writer"))
            .toList();
    collection.success(collection.claim(), new CatalogAdapter.Result(firstBooks, true));
    var before =
        search.search(new SearchRequest("paged fixture", null, null, null, 10, Intent.REBUILD));
    assertThat(before.collection().canExtend()).isTrue();
    var freshness = before.revalidateAfter();
    now = now.plusMinutes(5);
    var extend =
        CatalogText.command(
            new SearchRequest("paged fixture", null, null, null, 20, Intent.EXTEND));
    for (int i = 0; i < 3; i++) collection.submit(extend);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class))
        .isEqualTo(2);
    Job job = collection.claim();
    assertThat(job.getPageNumber()).isEqualTo(2);
    // Repeated book across provider pages must not duplicate snapshot membership.
    collection.success(
        job,
        new CatalogAdapter.Result(
            List.of(firstBooks.getFirst(), fixture(21, "paged fixture 21", "Writer")), false));
    var after = rebuild("paged fixture");
    assertThat(after.visibleCount()).isEqualTo(21);
    assertThat(after.revalidateAfter()).isEqualTo(freshness);
    assertThat(after.collection().generation()).isEqualTo(query.getGeneration());
    assertThat(after.collection().canExtend()).isFalse();
    var next = search.next(before.snapshotId(), before.nextCursor(), 20);
    assertThat(next.appliedResultVersion()).isEqualTo(before.appliedResultVersion());
    assertThat(next.collection().resultVersion()).isGreaterThan(next.appliedResultVersion());
    assertThat(next.candidates())
        .extracting(Candidate::title)
        .containsExactlyElementsOf(
            java.util.stream.IntStream.range(11, 21).mapToObj(i -> "paged fixture " + i).toList());
    assertThat(next.nextCursor()).isNull();
  }

  @Test
  void terminalExtensionFailureKeepsFirstPageAndStopsThatSource() {
    Query query = submit("failed extension fixture");
    var firstBooks =
        java.util.stream.IntStream.range(1, 21)
            .mapToObj(i -> fixture(i, "failed extension fixture " + i, "Writer"))
            .toList();
    collection.success(collection.claim(), new CatalogAdapter.Result(firstBooks, true));
    var before = rebuild("failed extension fixture");
    assertThat(before.collection().canExtend()).isTrue();
    var freshness = before.revalidateAfter();

    now = now.plusMinutes(5);
    var extend =
        CatalogText.command(
            new SearchRequest("failed extension fixture", null, null, null, 20, Intent.EXTEND));
    collection.submit(extend);
    Job secondPage = collection.claim();
    assertThat(secondPage.getPageNumber()).isEqualTo(2);
    collection.failure(secondPage, new SourceFailure("INVALID_RESPONSE"));

    var after = rebuild("failed extension fixture");
    assertThat(after.candidates())
        .extracting(Candidate::title)
        .containsExactlyElementsOf(
            java.util.stream.IntStream.range(1, 21)
                .mapToObj(i -> "failed extension fixture " + i)
                .toList());
    assertThat(after.visibleCount()).isEqualTo(20);
    assertThat(after.revalidateAfter()).isEqualTo(freshness);
    assertThat(after.collection().generation()).isEqualTo(query.getGeneration());
    assertThat(after.collection().lastOutcome()).isEqualTo("PARTIAL");
    assertThat(after.collection().retryAfterSeconds()).isNull();
    assertThat(after.collection().failedSourceCount()).isEqualTo(1);
    assertThat(after.collection().canExtend()).isFalse();
    assertThat(
            jdbc.queryForMap(
                "SELECT completed_page,has_more FROM catalog_search_source_runs"
                    + " WHERE query_entry_id=? AND generation=? AND source_id=?",
                query.getId(),
                query.getGeneration(),
                sourceId))
        .containsEntry("completed_page", 1)
        .containsEntry("has_more", false);

    collection.submit(extend);
    assertThat(collection.claim()).isNull();
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class))
        .isEqualTo(2);
  }

  @Test
  void relationalSnapshotPagesBeyondTwoHundredWithoutDuplicates() {
    for (int start = 1; start <= 205; start += 20) {
      submit("snapshot batch " + start);
      var batch =
          java.util.stream.IntStream.range(start, Math.min(start + 20, 206))
              .mapToObj(i -> fixture(i, "large fixture " + i, "Writer"))
              .toList();
      collection.success(collection.claim(), new CatalogAdapter.Result(batch, false));
    }
    var page =
        search.search(new SearchRequest("large fixture", null, null, null, 20, Intent.REBUILD));
    assertThat(page.visibleCount()).isEqualTo(205);
    Set<Long> seen = new HashSet<>();
    while (true) {
      for (var candidate : page.candidates())
        assertThat(seen.add(candidate.catalogBookId())).isTrue();
      if (page.nextCursor() == null) break;
      page = search.next(page.snapshotId(), page.nextCursor(), 20);
    }
    assertThat(seen).hasSize(205);
  }

  @Test
  void extensionStopsAtFivePagesAndExpiredQueryTextCannotEnqueue() {
    submit("bounded fixture");
    for (int page = 1; page <= 5; page++) {
      var job = collection.claim();
      assertThat(job.getPageNumber()).isEqualTo(page);
      collection.success(
          job,
          new CatalogAdapter.Result(
              List.of(fixture(page, "bounded fixture " + page, "Writer")), true));
      var response =
          search.search(new SearchRequest("bounded fixture", null, null, null, 20, Intent.EXTEND));
      if (page == 5) assertThat(response.collection().canExtend()).isFalse();
    }
    assertThat(collection.claim()).isNull();
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class))
        .isEqualTo(5);
    submit("expired fixture");
    collection.success(
        collection.claim(),
        new CatalogAdapter.Result(List.of(fixture(99, "expired fixture", "Writer")), true));
    now = now.plusHours(24);
    var expired =
        search.search(new SearchRequest("expired fixture", null, null, null, 20, Intent.EXTEND));
    assertThat(expired.collection().canExtend()).isFalse();
    assertThat(collection.claim()).isNull();
  }

  @Test
  void recordedCorpusRejectsUnrelatedNgramsPreservesSourceOrderAndThirtyDayCache()
      throws Exception {
    JsonNode corpus;
    try (var stream = getClass().getResourceAsStream("/catalog/live-review-2026-09-07.json")) {
      corpus = json.readTree(stream);
    }
    Map<Long, NormalizedBook> data = new LinkedHashMap<>();
    for (var b : corpus.path("books")) {
      List<String> authors = new ArrayList<>();
      b.path("authors").forEach(a -> authors.add(a.asText()));
      data.put(
          b.path("id").asLong(),
          new NormalizedBook(
              b.path("externalId").asText(),
              b.path("sourceUrl").asText(),
              b.path("title").asText(),
              b.path("subtitle").asText(null),
              authors,
              b.path("isbn13").asText(null),
              b.path("publisher").asText(null),
              b.path("publishedDate").asText(null),
              b.path("language").asText(null),
              b.path("format").asText(),
              null,
              null,
              null,
              null));
    }
    var all = new ArrayList<>(data.values());
    for (int i = 0; i < all.size(); i += 20) {
      submit("replay batch " + i);
      collection.success(
          collection.claim(),
          new CatalogAdapter.Result(all.subList(i, Math.min(i + 20, all.size())), false));
    }
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_books", Long.class))
        .isEqualTo(128);
    Map<Long, Long> ids = new HashMap<>();
    data.forEach(
        (oldId, book) ->
            ids.put(oldId, books.record(sourceId, book.externalId(), false).getCatalogBookId()));
    Map<String, Query> entries = new HashMap<>();
    Map<String, List<Long>> expected = new HashMap<>();
    for (var q : corpus.path("queries")) {
      String keyword = q.path("keyword").asText();
      List<Long> oldIds = new ArrayList<>();
      q.path("ids").forEach(id -> oldIds.add(id.asLong()));
      entries.put(keyword, submit(keyword));
      collection.success(
          collection.claim(),
          new CatalogAdapter.Result(oldIds.stream().map(data::get).toList(), false));
      expected.put(keyword, oldIds.stream().map(ids::get).toList());
    }
    long jobCount = jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class);
    // Check reuse for the entire recorded keyword set, including empty Korean/typo results.
    for (var entry : entries.entrySet()) {
      assertThat(queries.find(entry.getValue().getId()).getRevalidateAfter())
          .as(entry.getKey())
          .isEqualTo(now.plusDays(30));
      assertThat(submit(entry.getKey()).getGeneration()).as(entry.getKey()).isEqualTo(1);
    }
    for (String keyword :
        List.of(
            "Michael Ende",
            "The Lord of the Rings",
            "Andy Weir",
            "Project Hail Mary",
            "Harry Potter",
            "해리포터")) {
      var response = rebuild(keyword);
      var returned = response.candidates().stream().map(Candidate::catalogBookId).toList();
      assertThat(returned).as(keyword).containsAll(expected.get(keyword));
      if (!keyword.contains("Potter") && !keyword.contains("포터"))
        assertThat(response.candidates())
            .as(keyword)
            .noneMatch(
                c ->
                    c.title().contains("Harry Potter")
                        || c.title().contains("해리포터")
                        || c.title().equals("채식주의자"));
      var entry = queries.find(entries.get(keyword).getId());
      assertThat(entry.getRevalidateAfter()).isEqualTo(now.plusDays(30));
      assertThat(submit(keyword).getGeneration()).isEqualTo(1);
      assertThat(queries.snapshot(response.snapshotId(), false).getRankingVersion())
          .isEqualTo("v3");
      System.out.println(
          "Catalog recorded replay: "
              + keyword
              + " source_ids="
              + expected.get(keyword).size()
              + " visible="
              + response.visibleCount()
              + " top="
              + response.candidates().getFirst().title());
    }
    assertThat(rebuild("Harry Potter").candidates().getFirst().title())
        .isEqualTo("Harry Potter and the Sorcerer's Stone");
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class))
        .isEqualTo(jobCount);
    assertThat(jdbc.queryForObject("SELECT SUM(requests_today) FROM catalog_sources", Long.class))
        .isZero();

    // Previously issued v1 snapshots remain readable in their original order.
    var old = search.search(new SearchRequest("Harry Potter", null, null, null, 1, Intent.REBUILD));
    var snapshot = queries.snapshot(old.snapshotId(), false);
    var original = json.readTree(snapshot.getRankedBooks());
    List<Long> reversed = new ArrayList<>();
    original.forEach(id -> reversed.add(id.asLong()));
    Collections.reverse(reversed);
    jdbc.update(
        "UPDATE catalog_search_snapshots SET ranking_version='v1',ranked_books=? WHERE public_id=?",
        json.writeValueAsString(reversed),
        old.snapshotId());
    assertThat(rebuild("Harry Potter").candidates().getFirst().title())
        .isEqualTo("Harry Potter and the Sorcerer's Stone");
    assertThat(
            search.next(old.snapshotId(), old.nextCursor(), 40).candidates().stream()
                .map(Candidate::catalogBookId)
                .toList())
        .containsExactlyElementsOf(reversed.subList(1, reversed.size()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"BACKOFF", "DAILY", "INTERVAL"})
  void localDeferralNeverExtendsCircuitOrConsumesAnAttempt(String reason) {
    if (reason.equals("BACKOFF"))
      jdbc.update(
          "UPDATE catalog_sources SET backoff_until=?,consecutive_failures=4 WHERE id=?",
          now.plusSeconds(120),
          sourceId);
    if (reason.equals("DAILY"))
      jdbc.update(
          "UPDATE catalog_sources SET requests_today=500,quota_date=? WHERE id=?",
          now.toLocalDate(),
          sourceId);
    if (reason.equals("INTERVAL"))
      jdbc.update(
          "UPDATE catalog_sources SET next_request_at=? WHERE id=?", now.plusSeconds(10), sourceId);
    var before = sources.source(sourceId);
    var query = submit("deferred " + reason);
    var job = collection.claim();
    SourceFailure error =
        catchThrowableOfType(() -> gate.reserve(sourceId, false, now), SourceFailure.class);
    assertThat(error).isNotNull();
    assertThat(error.localDeferral()).isTrue();
    collection.failure(job, error);
    var after = sources.source(sourceId);
    assertThat(after.getConsecutiveFailures()).isEqualTo(before.getConsecutiveFailures());
    assertThat(after.getBackoffUntil()).isEqualTo(before.getBackoffUntil());
    assertThat(after.getRequestsToday()).isEqualTo(before.getRequestsToday());
    var deferred = jobs.generation(query.getId(), 1).getFirst();
    assertThat(deferred.getAttemptCount()).isZero();
    assertThat(deferred.getState()).isEqualTo(reason.equals("DAILY") ? "FAILED" : "RETRY");
    if (!reason.equals("DAILY")) {
      assertThat(deferred.getAvailableAt()).isEqualTo(now.plusSeconds(error.retryAfterSeconds()));
      now = deferred.getAvailableAt();
      var resumed = collection.claim();
      assertThat(resumed.getAttemptCount()).isEqualTo(1);
      gate.reserve(sourceId, false, now);
      collection.success(resumed, new CatalogAdapter.Result(List.of(), false));
      assertThat(queries.find(query.getId()).getLastOutcome()).isEqualTo("SUCCEEDED");
    } else assertThat(queries.find(query.getId()).getRevalidateAfter()).isNull();
  }

  @Test
  void repeatedKeywordsInBackoffDoNotPostponeRecoveryAndActual429StillCounts() {
    submit("first actual failure");
    var job = collection.claim();
    gate.reserve(sourceId, false, now);
    collection.failure(job, new SourceFailure("RATE_LIMITED", 120));
    var before = sources.source(sourceId);
    assertThat(before.getConsecutiveFailures()).isEqualTo(1);
    for (int i = 0; i < 8; i++) {
      now = now.plusSeconds(1);
      var query = submit("waiting keyword " + i);
      var waiting = collection.claim();
      SourceFailure error =
          catchThrowableOfType(() -> gate.reserve(sourceId, false, now), SourceFailure.class);
      collection.failure(waiting, error);
      assertThat(jobs.generation(query.getId(), 1).getFirst().getAttemptCount()).isZero();
    }
    var after = sources.source(sourceId);
    assertThat(after.getConsecutiveFailures()).isEqualTo(1);
    assertThat(after.getBackoffUntil()).isEqualTo(before.getBackoffUntil());
    assertThat(after.getRequestsToday()).isEqualTo(1);
    now = before.getBackoffUntil();
    for (int attempt = 2; attempt <= 3; attempt++) {
      var retry = collection.claim();
      assertThat(retry.getId()).isEqualTo(job.getId());
      assertThat(retry.getAttemptCount()).isEqualTo(attempt);
      gate.reserve(sourceId, false, now);
      collection.failure(retry, new SourceFailure("RATE_LIMITED", 1));
      if (attempt == 2) now = now.plusSeconds(30);
      // Other queued keyword jobs are isolated from this assertion of the original job's budget.
      jdbc.update(
          "UPDATE catalog_crawl_jobs SET available_at=? WHERE id<>?",
          now.plusMinutes(5),
          job.getId());
    }
    assertThat(
            jobs.recent().stream()
                .filter(j -> j.getId().equals(job.getId()))
                .findFirst()
                .orElseThrow()
                .getState())
        .isEqualTo("FAILED");
    assertThat(sources.source(sourceId).getRequestsToday()).isEqualTo(3);
  }
}
