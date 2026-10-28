package com.margins;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.margins.auth.security.MarginsUserPrincipal;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.catalog.business.*;
import com.margins.book.catalog.controller.CatalogCoverController;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import com.margins.book.catalog.service.CatalogService;
import com.margins.common.error.*;
import com.margins.testsupport.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

@AutoConfigureMockMvc
class CatalogFlowIntegrationTest extends AbstractMySqlIntegrationTest {
  @Autowired CatalogCollectionBusiness collection;
  @Autowired CatalogSearchBusiness search;
  @Autowired CatalogSaveBusiness save;
  @Autowired CatalogCoverBusiness coverBusiness;
  @Autowired CatalogRetentionBusiness retention;
  @Autowired CatalogCoverMapper covers;
  @Autowired CatalogSearchMapper queries;
  @Autowired CatalogJobMapper jobs;
  @Autowired CatalogSourceRegistry registry;
  @Autowired CatalogSourceMapper sources;
  @Autowired CatalogBookMapper catalogBooks;
  @Autowired CatalogService service;
  @Autowired TransactionTemplate tx;
  @Autowired CatalogSourceGate gate;
  @Autowired MockMvc mvc;
  @Autowired com.margins.book.catalog.config.CatalogProperties properties;
  @Autowired com.margins.testsupport.business.JdbcTestDataResetExecutor reset;
  @MockBean CatalogTime time;
  @MockBean BookKnowledgeBusiness knowledge;
  JdbcTemplate jdbc;
  LocalDateTime now;
  long sourceId;

  @BeforeEach
  void setup() throws Exception {
    jdbc = new JdbcTemplate(dataSource);
    clean();
    IntegrationSchemaSupport.resetBooksAndUsers(dataSource);
    now = LocalDateTime.of(2026, 9, 1, 0, 0);
    when(time.now()).thenAnswer(invocation -> now);
    registry.initialize();
    jdbc.update(
        "UPDATE catalog_sources SET"
            + " status='DISABLED',backoff_until=NULL,consecutive_failures=0,next_request_at=NULL,quota_date=NULL,requests_today=0,daily_request_limit=500");
    properties.setOperatorUserIds(Set.of());
    jdbc.update(
        "UPDATE catalog_sources SET"
            + " status='ACTIVE',metadata_policy='ALLOWED',cover_policy='ALLOWED',approved_fields=JSON_ARRAY('title','subtitle','authors','isbn13','publisher','publishedDate','language','format','pageCount'),policy_version=1"
            + " WHERE code='open_library'");
    sourceId =
        jdbc.queryForObject("SELECT id FROM catalog_sources WHERE code='open_library'", Long.class);
    auth();
  }

  @AfterEach
  void cleanup() {
    SecurityContextHolder.clearContext();
    clean();
  }

  void clean() {
    if (jdbc == null) return;
    tx.executeWithoutResult(
        status -> {
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
        });
  }

  void auth() {
    var principal = new MarginsUserPrincipal(1L, "fixture", "Fixture", "local");
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
  }

  SearchRequest request(String keyword) {
    return new SearchRequest(keyword, null, null, null, 20, Intent.SUBMIT);
  }

  NormalizedBook book(String id, String title, String isbn) {
    return new NormalizedBook(
        id,
        "https://openlibrary.org/books/" + id,
        title,
        null,
        List.of("Fixture Author"),
        isbn,
        "Fixture Press",
        "2026-09",
        "en",
        "PRINT",
        120,
        null,
        "https://covers.openlibrary.org/b/id/1-M.jpg",
        null);
  }

  Query submit(String text) {
    return collection.submit(CatalogText.command(request(text)));
  }

  void complete(Job job, NormalizedBook... books) {
    collection.success(job, new CatalogAdapter.Result(List.of(books), false));
  }

  @Test
  void successfulEmptyIsCachedForExactlyThirtyDaysAndRebuildDoesNotCollect() {
    Query q = submit("empty fixture");
    Job first = collection.claim();
    assertThat(first).isNotNull();
    complete(first);
    Query finished = queries.find(q.getId());
    assertThat(finished.getLastOutcome()).isEqualTo("SUCCEEDED");
    assertThat(finished.getRevalidateAfter()).isEqualTo(now.plusDays(30));
    now = now.plusDays(30).minusNanos(1000);
    assertThat(submit(" EMPTY   fixture ").getGeneration()).isEqualTo(1);
    now = now.plusNanos(1000);
    var rebuild =
        new SearchRequest("empty fixture", Field.TITLE, "ko", Format.EBOOK, 20, Intent.REBUILD);
    assertThat(collection.submit(CatalogText.command(rebuild)).getGeneration()).isEqualTo(1);
    assertThat(submit("empty fixture").getGeneration()).isEqualTo(2);
  }

  @Test
  void concurrentKeywordSubmissionsCreateOnlyOneGeneration() throws Exception {
    try (var pool = Executors.newFixedThreadPool(4)) {
      var tasks = new ArrayList<Future<Query>>();
      for (int i = 0; i < 20; i++) tasks.add(pool.submit(() -> submit("concurrent fixture")));
      for (var task : tasks)
        assertThat(task.get(10, TimeUnit.SECONDS).getGeneration()).isEqualTo(1);
    }
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class))
        .isEqualTo(1);
  }

  @Test
  void terminalCoverFailureUpdatesTheCardWithoutDisablingMetadataSearch() {
    Query query = submit("cover failure");
    complete(collection.claim(), book("OL1M", "Cover failure", null));
    Job cover = collection.claim();
    int version = queries.find(query.getId()).getCoverVersion();
    collection.failure(cover, new SourceFailure("BLOCKED"));
    assertThat(catalogBooks.recordId(cover.getSourceRecordId()).getCoverStatus())
        .isEqualTo("DENIED");
    assertThat(sources.source(sourceId).getStatus()).isEqualTo("ACTIVE");
    assertThat(queries.find(query.getId()).getCoverVersion()).isGreaterThan(version);
  }

  @Test
  void sourceExpiryScrubsCopiedProviderPayloadAndPublicProjectionWithoutDeletingReadingIdentity() {
    jdbc.update(
        "UPDATE catalog_sources SET"
            + " cover_policy='UNREVIEWED',metadata_ttl_seconds=60,approved_fields=JSON_ARRAY_APPEND(approved_fields,'$','description')"
            + " WHERE id=?",
        sourceId);
    submit("expiry copies");
    complete(
        collection.claim(),
        new NormalizedBook(
            "OL1M",
            "https://openlibrary.org/books/OL1M",
            "Stable reading identity",
            null,
            List.of("Author"),
            "9780140328721",
            null,
            null,
            "en",
            "PRINT",
            null,
            "Licensed description",
            null,
            null));
    long id = jdbc.queryForObject("SELECT id FROM catalog_books", Long.class);
    var saved = save.save(new SaveRequest(id));
    assertThat(
            jdbc.queryForObject(
                "SELECT JSON_CONTAINS_PATH(raw_metadata,'one','$.catalogOrigin.records') FROM books"
                    + " WHERE id=?",
                Integer.class,
                saved.getBookId()))
        .isEqualTo(1);
    now = now.plusSeconds(61);
    retention.maintain();
    assertThat(
            jdbc.queryForObject(
                "SELECT normalized_payload FROM catalog_book_sources", String.class))
        .isNull();
    assertThat(jdbc.queryForObject("SELECT title FROM catalog_books WHERE id=?", String.class, id))
        .isEqualTo("[unavailable]");
    assertThat(
            jdbc.queryForObject(
                "SELECT description FROM books WHERE id=?", String.class, saved.getBookId()))
        .isNull();
    assertThat(
            jdbc.queryForObject(
                "SELECT JSON_CONTAINS_PATH(raw_metadata,'one','$.providerMetadata') FROM books"
                    + " WHERE id=?",
                Integer.class,
                saved.getBookId()))
        .isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT title FROM books WHERE id=?", String.class, saved.getBookId()))
        .isEqualTo("Stable reading identity");
    jdbc.update("UPDATE catalog_sources SET metadata_ttl_seconds=NULL WHERE id=?", sourceId);
  }

  @Test
  void laterIsbnIdentifiesTheSameEditionAndHiddenBooksNeverResurrect() {
    jdbc.update("UPDATE catalog_sources SET cover_policy='UNREVIEWED'");
    submit("first identity");
    complete(collection.claim(), book("OL1M", "Edition", null));
    long id = jdbc.queryForObject("SELECT id FROM catalog_books", Long.class);
    submit("second identity");
    complete(collection.claim(), book("OL1M", "Edition", "9780140328721"));
    assertThat(catalogBooks.isbn("9780140328721", false).getId()).isEqualTo(id);
    jdbc.update("UPDATE catalog_books SET status='HIDDEN' WHERE id=?", id);
    submit("hidden identity");
    complete(collection.claim(), book("OL2M", "Must remain hidden", "9780140328721"));
    assertThat(jdbc.queryForObject("SELECT status FROM catalog_books WHERE id=?", String.class, id))
        .isEqualTo("HIDDEN");
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_books", Long.class)).isEqualTo(1);
  }

  @Test
  void resultsSnapshotServerSaveAndDuplicateDetection() {
    var initial = search.search(request("fixture"));
    assertThat(initial.resultState()).isEqualTo("COLLECTING");
    Job job = collection.claim();
    complete(job, book("OL1M", "Fixture Book", "9780140328721"));
    var result = search.search(new SearchRequest("fixture", null, null, null, 20, Intent.REBUILD));
    assertThat(result.candidates()).hasSize(1);
    var candidate = result.candidates().getFirst();
    assertThat(candidate.title()).isEqualTo("Fixture Book");
    assertThat(candidate.thumbnail()).isNull();
    assertThat(candidate.sources()).hasSize(1);
    var saved = save.save(new SaveRequest(candidate.catalogBookId()));
    assertThat(saved.getTitle()).isEqualTo("Fixture Book");
    assertThat(search.detail(candidate.catalogBookId()).savedBookId()).isEqualTo(saved.getBookId());
    assertThatThrownBy(() -> save.save(new SaveRequest(candidate.catalogBookId())))
        .isInstanceOf(ApiException.class);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM books WHERE catalog_book_id=?",
                Long.class,
                candidate.catalogBookId()))
        .isEqualTo(1);
  }

  @Test
  void cursorIsSignedAndExpiredSnapshotReturnsGone() {
    Query q = submit("fixture");
    Job job = collection.claim();
    complete(job, book("OL1M", "Fixture A", null), book("OL2M", "Fixture B", null));
    var first = search.search(new SearchRequest("fixture", null, null, null, 1, Intent.REBUILD));
    assertThat(first.nextCursor()).isNotBlank();
    var second = search.next(first.snapshotId(), first.nextCursor(), 1);
    assertThat(second.candidates()).hasSize(1);
    assertThat(second.candidates().getFirst().catalogBookId())
        .isNotEqualTo(first.candidates().getFirst().catalogBookId());
    assertThatThrownBy(() -> search.next(first.snapshotId(), first.nextCursor() + "x", 1))
        .isInstanceOf(ApiException.class);
    now = now.plusMinutes(15);
    assertThatThrownBy(() -> search.next(first.snapshotId(), first.nextCursor(), 1))
        .isInstanceOf(ApiException.class)
        .extracting(ex -> ((ApiException) ex).getCode())
        .isEqualTo(ApiErrorCode.CATALOG_SNAPSHOT_EXPIRED);
  }

  @Test
  void staleLeaseCompletionCannotWriteBooks() {
    submit("lease fixture");
    Job first = collection.claim();
    now = now.plusSeconds(61);
    Job reclaimed = collection.claim();
    assertThat(reclaimed.getId()).isEqualTo(first.getId());
    assertThat(reclaimed.getLeaseToken()).isNotEqualTo(first.getLeaseToken());
    complete(first, book("OL1M", "Must not appear", null));
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_books", Long.class)).isZero();
    complete(reclaimed, book("OL2M", "Correct winner", null));
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_books", Long.class)).isEqualTo(1);
  }

  @Test
  void sourceFailuresDoNotBecomeNegativeCache() {
    Query query = submit("failure fixture");
    Job job = collection.claim();
    collection.failure(job, new SourceFailure("INVALID_RESPONSE"));
    Query failed = queries.find(query.getId());
    assertThat(failed.getLastOutcome()).isEqualTo("FAILED");
    assertThat(failed.getRevalidateAfter()).isNull();
    assertThat(submit("failure fixture").getGeneration()).isEqualTo(1);
    now = now.plusMinutes(1);
    assertThat(submit("failure fixture").getGeneration()).isEqualTo(2);
  }

  @Test
  void noKeysOrEligibleSourcesIsDeferredNotEmpty() {
    jdbc.update("UPDATE catalog_sources SET status='DISABLED'");
    Query query = submit("keyless fixture");
    assertThat(query.getLastOutcome()).isEqualTo("DEFERRED");
    assertThat(query.getRevalidateAfter()).isNull();
    assertThat(collection.claim()).isNull();
  }

  @Test
  void deadlineRecoversAndNeverWritesLateResults() {
    Query query = submit("deadline fixture");
    Job job = collection.claim();
    now = now.plusMinutes(10);
    collection.recover();
    complete(job, book("OL1M", "Late", null));
    assertThat(queries.find(query.getId()).getLastOutcome()).isEqualTo("FAILED");
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_books", Long.class)).isZero();
  }

  @Test
  void coverBudgetEtagWithdrawalAndPrivateCoverPointer() {
    submit("cover fixture");
    complete(collection.claim(), book("OL1M", "Fixture cover", "9780140328721"));
    long bookId = jdbc.queryForObject("SELECT id FROM catalog_books", Long.class);
    var saved = save.save(new SaveRequest(bookId));
    Job cover = collection.claim();
    assertThat(cover.getKind()).isEqualTo("FETCH_COVER");
    byte[] image = {1, 2, 3, 4};
    coverBusiness.store(
        cover,
        "https://covers.openlibrary.org/b/id/1-M.jpg",
        new CatalogCoverProcessor.Image(image, "image/jpeg", 10, 15));
    long coverId = jdbc.queryForObject("SELECT id FROM catalog_cover_assets", Long.class);
    assertThat(covers.budget().getUsedBytes()).isEqualTo(4);
    assertThat(covers.actualBytes()).isEqualTo(4);
    assertThat(service.image(coverId, CatalogText.hash(image))).isEqualTo(image);
    assertThat(
            jdbc.queryForObject(
                "SELECT cover_image_url FROM books WHERE id=?", String.class, saved.getBookId()))
        .startsWith("/api/catalog/covers/");
    var controller = new CatalogCoverController(service);
    String hash = CatalogText.hex(CatalogText.hash(image));
    assertThat(controller.image(coverId, hash, null).getStatusCode().value()).isEqualTo(200);
    assertThat(controller.image(coverId, hash, "\"" + hash + "\"").getStatusCode().value())
        .isEqualTo(304);
    coverBusiness.withdraw(coverId, true);
    assertThat(covers.budget().getUsedBytes()).isZero();
    assertThat(controller.image(coverId, hash, "\"" + hash + "\"").getStatusCode().value())
        .isEqualTo(404);
    assertThat(
            jdbc.queryForObject(
                "SELECT cover_image_url FROM books WHERE id=?", String.class, saved.getBookId()))
        .isNull();
  }

  @Test
  void budgetFullOnlyFailsCover() {
    Query query = submit("full fixture");
    complete(collection.claim(), book("OL1M", "Fixture", null));
    jdbc.update("UPDATE catalog_storage_budget SET used_bytes=10000000000");
    Job cover = collection.claim();
    coverBusiness.store(
        cover,
        "https://covers.openlibrary.org/b/id/1-M.jpg",
        new CatalogCoverProcessor.Image(new byte[] {1}, "image/jpeg", 1, 1));
    assertThat(
            jobs.recent().stream()
                .filter(j -> j.getId().equals(cover.getId()))
                .findFirst()
                .orElseThrow()
                .getSafeErrorCode())
        .isEqualTo("STORAGE_BUDGET_EXCEEDED");
    assertThat(queries.find(query.getId()).getLastOutcome()).isEqualTo("SUCCEEDED");
    assertThat(covers.actualBytes()).isZero();
  }

  @Test
  void withdrawnSourceCannotLeakThroughProjectionOrExistingSnapshot() {
    submit("rights fixture");
    complete(collection.claim(), book("OL1M", "Fixture A", null), book("OL2M", "Fixture B", null));
    var first = search.search(new SearchRequest("fixture", null, null, null, 1, Intent.REBUILD));
    jdbc.update("UPDATE catalog_sources SET metadata_policy='DENIED' WHERE id=?", sourceId);
    assertThat(search.next(first.snapshotId(), first.nextCursor(), 1).candidates()).isEmpty();
    assertThatThrownBy(() -> search.detail(first.candidates().getFirst().catalogBookId()))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void partialSuccessHasThirtyDayCacheButAllFailedEmptyDoesNot() {
    jdbc.update(
        "UPDATE catalog_sources SET"
            + " status='ACTIVE',metadata_policy='ALLOWED',approved_fields=JSON_ARRAY('title','authors','isbn13')"
            + " WHERE code='google_books'");
    Query query = submit("partial fixture");
    Job first = collection.claim(), second = collection.claim();
    assertThat(first.getSourceId()).isEqualTo(sourceId);
    complete(first, book("OL1M", "Partial Fixture", null));
    collection.failure(second, new SourceFailure("INVALID_RESPONSE"));
    var result = queries.find(query.getId());
    assertThat(result.getLastOutcome()).isEqualTo("PARTIAL");
    assertThat(result.getRevalidateAfter()).isEqualTo(now.plusDays(30));
    assertThat(submit("partial fixture").getGeneration()).isEqualTo(1);
    assertThat(
            search.detail(jdbc.queryForObject("SELECT id FROM catalog_books", Long.class)).title())
        .isEqualTo("Partial Fixture");
  }

  @Test
  void distributedQuotaReservationAnd429Backoff() throws Exception {
    jdbc.update(
        "UPDATE catalog_sources SET daily_request_limit=2,min_interval_ms=1000 WHERE id=?",
        sourceId);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var first = pool.submit(() -> gate.reserve(sourceId, false, now));
      var second = pool.submit(() -> gate.reserve(sourceId, true, now));
      assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(0L, 1000L);
    }
    assertThatThrownBy(() -> gate.reserve(sourceId, false, now)).isInstanceOf(SourceFailure.class);
    Query query = submit("retry fixture");
    Job job = collection.claim();
    collection.failure(job, new SourceFailure("RATE_LIMITED", 120));
    now = now.plusSeconds(119);
    assertThat(collection.claim()).isNull();
    now = now.plusSeconds(1);
    assertThat(collection.claim().getId()).isEqualTo(job.getId());
    assertThat(queries.find(query.getId()).getRevalidateAfter()).isNull();
  }

  @Test
  void simultaneousSavesProduceOnePrivateBookAndOneAfterCommitEvent() throws Exception {
    submit("save race");
    complete(collection.claim(), book("OL1M", "Save fixture", null));
    long id = jdbc.queryForObject("SELECT id FROM catalog_books", Long.class);
    try (var pool = Executors.newFixedThreadPool(2)) {
      java.util.concurrent.Callable<Boolean> attempt =
          () -> {
            auth();
            try {
              save.save(new SaveRequest(id));
              return true;
            } catch (ApiException ex) {
              assertThat(ex.getCode()).isEqualTo(ApiErrorCode.BOOK_ALREADY_EXISTS);
              return false;
            } finally {
              SecurityContextHolder.clearContext();
            }
          };
      var one = pool.submit(attempt);
      var two = pool.submit(attempt);
      assertThat(List.of(one.get(), two.get())).containsExactlyInAnyOrder(true, false);
    }
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM books WHERE catalog_book_id=?", Long.class, id))
        .isEqualTo(1);
    verify(knowledge, timeout(3000).times(1)).ensureForBook(anyLong(), eq(1L));
  }

  @Test
  void rollbackDoesNotPublishKnowledgeOrCreatePrivateBook() {
    submit("rollback fixture");
    complete(collection.claim(), book("OL1M", "Rollback fixture", null));
    long id = jdbc.queryForObject("SELECT id FROM catalog_books", Long.class);
    tx.executeWithoutResult(
        status -> {
          save.save(new SaveRequest(id));
          status.setRollbackOnly();
        });
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM books WHERE catalog_book_id=?", Long.class, id))
        .isZero();
    verify(knowledge, after(200).never()).ensureForBook(anyLong(), anyLong());
  }

  @Test
  void publicProjectionCannotLeakOtherUsersLibraryState() {
    submit("private fixture");
    complete(collection.claim(), book("OL1M", "Private Fixture", null));
    long id = jdbc.queryForObject("SELECT id FROM catalog_books", Long.class);
    save.save(new SaveRequest(id));
    assertThat(search.detail(id).inLibrary()).isTrue();
    var other = new MarginsUserPrincipal(2L, "other", "Other", "local");
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(other, null, other.getAuthorities()));
    assertThat(search.detail(id).inLibrary()).isFalse();
    assertThat(search.detail(id).savedBookId()).isNull();
  }

  @Test
  void apiAuthenticationAndOperatorBoundary() throws Exception {
    assertThat(service.capabilities().operator()).isFalse();
    assertThatThrownBy(service::operations).isInstanceOf(ApiException.class);
    properties.setOperatorUserIds(Set.of(1L));
    assertThat(service.operations().sources()).hasSize(8);
    SecurityContextHolder.clearContext();
    mvc.perform(get("/api/catalog/covers/1/" + "a".repeat(64))).andExpect(status().isNotFound());
    mvc.perform(
            post("/api/catalog/search")
                .contentType("application/json")
                .content("{\"query\":\"fixture\"}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/catalog/operations")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/catalog/covers/1/" + "a".repeat(64)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void concurrentCoverWritesCannotExceedBudget() throws Exception {
    submit("cover race");
    complete(collection.claim(), book("OL1M", "Cover A", null), book("OL2M", "Cover B", null));
    Job one = collection.claim(), two = collection.claim();
    jdbc.update("UPDATE catalog_storage_budget SET used_bytes=9999999996");
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () ->
                  coverBusiness.store(
                      one,
                      "https://covers.openlibrary.org/b/id/1-M.jpg",
                      new CatalogCoverProcessor.Image(
                          new byte[] {1, 2, 3, 4}, "image/jpeg", 1, 1)));
      var b =
          pool.submit(
              () ->
                  coverBusiness.store(
                      two,
                      "https://covers.openlibrary.org/b/id/1-M.jpg",
                      new CatalogCoverProcessor.Image(
                          new byte[] {5, 6, 7, 8}, "image/jpeg", 1, 1)));
      a.get();
      b.get();
    }
    assertThat(covers.budget().getUsedBytes()).isEqualTo(10_000_000_000L);
    assertThat(covers.count()).isEqualTo(1);
    assertThat(covers.actualBytes()).isEqualTo(4);
  }

  @Test
  void rawKeywordsAndExpiredPayloadsArePurgedWithoutRemovingCooldown() {
    Query query = submit("retention fixture");
    complete(collection.claim(), book("OL1M", "Retention", null));
    jdbc.update("UPDATE catalog_book_sources SET expires_at=?", now.plusHours(1));
    now = now.plusHours(24);
    queries.clearText(now);
    catalogBooks.expirePayloads(now);
    Query retained = queries.find(query.getId());
    assertThat(retained.getQueryText()).isNull();
    assertThat(retained.getRevalidateAfter()).isNotNull();
    assertThat(submit("retention fixture").getGeneration()).isEqualTo(1);
    assertThat(
            search
                .search(new SearchRequest("retention", null, null, null, 20, Intent.REBUILD))
                .candidates())
        .isEmpty();
  }

  @Test
  void resetReleasesOnlyTestCoverBytesAndKeepsProductionBudget() {
    submit("reset fixture");
    complete(collection.claim(), book("OL1M", "Reset fixture", null));
    coverBusiness.store(
        collection.claim(),
        "https://covers.openlibrary.org/b/id/1-M.jpg",
        new CatalogCoverProcessor.Image(new byte[] {1, 2, 3, 4}, "image/jpeg", 1, 1));
    long original = jdbc.queryForObject("SELECT id FROM catalog_cover_assets", Long.class);
    jdbc.update(
        """
INSERT INTO catalog_cover_assets (source_record_id,sha256,source_url,mime_type,width,height,byte_size,image_bytes,policy_version,status,fetched_at,is_test_data)
SELECT source_record_id,?,source_url,mime_type,width,height,4,?,policy_version,status,fetched_at,TRUE FROM catalog_cover_assets WHERE id=?
""",
        CatalogText.hash(new byte[] {5, 6, 7, 8}),
        new byte[] {5, 6, 7, 8},
        original);
    jdbc.update("UPDATE catalog_storage_budget SET used_bytes=8");
    reset.resetTestData();
    assertThat(covers.actualBytes()).isEqualTo(4);
    assertThat(covers.budget().getUsedBytes()).isEqualTo(4);
    assertThat(covers.metadata(original)).isNotNull();
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog_cover_assets WHERE is_test_data=TRUE", Long.class))
        .isZero();
  }

  @Test
  void sixtyEditionFixtureSearchQualityAndWarmLatency() {
    List<NormalizedBook> corpus = new ArrayList<>();
    for (int group = 0; group < 3; group++) {
      List<NormalizedBook> batch = new ArrayList<>();
      for (int n = 0; n < 20; n++) {
        int index = group * 20 + n;
        String base = "978" + String.format("%09d", 100000000 + index);
        int sum = 0;
        for (int c = 0; c < 12; c++) sum += (base.charAt(c) - '0') * (c % 2 == 0 ? 1 : 3);
        String isbn = base + (10 - sum % 10) % 10;
        String title =
            (group == 0 ? "한국 작품 " : group == 1 ? "British edition " : "American edition ")
                + String.format("%02d", n);
        var data =
            new NormalizedBook(
                "/books/OL" + (100 + index) + "M",
                "https://openlibrary.org/books/OL" + (100 + index) + "M",
                title,
                null,
                List.of("Writer " + index),
                isbn,
                "Fixture Press",
                "2026",
                group == 0 ? "ko" : "en",
                "PRINT",
                120,
                null,
                null,
                null);
        batch.add(data);
        corpus.add(data);
      }
      submit("corpus group " + group);
      collection.success(collection.claim(), new CatalogAdapter.Result(batch, false));
    }
    List<Long> elapsed = new ArrayList<>();
    for (var fixture : corpus) {
      long start = System.nanoTime();
      var response =
          search.search(
              new SearchRequest(fixture.isbn13(), Field.ISBN, null, null, 20, Intent.REBUILD));
      elapsed.add((System.nanoTime() - start) / 1_000_000);
      assertThat(response.candidates().getFirst().isbn13()).isEqualTo(fixture.isbn13());
    }
    assertThat(
            search
                .search(new SearchRequest("한", Field.TITLE, "ko", Format.PRINT, 20, Intent.REBUILD))
                .candidates())
        .hasSize(20);
    Collections.sort(elapsed);
    long p95 = elapsed.get(56);
    System.out.println(
        "Catalog synthetic fixture: editions=60 ISBN Top1=60/60 Korean prefix=20/20 p95_ms=" + p95);
    assertThat(p95).isLessThan(300);
  }
}
