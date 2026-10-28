package com.margins.book.catalog.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import com.margins.common.error.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
public class CatalogSearchBusiness {
  private static final String RANKING_VERSION = "v4";
  private static final Set<String> ROW_RANKING_VERSIONS = Set.of("v3", RANKING_VERSION);

  private final CatalogSearchMapper queries;
  private final CatalogBookMapper books;
  private final CatalogCoverMapper covers;
  private final CatalogLibraryMapper library;
  private final CatalogProjection projection;
  private final CatalogCollectionBusiness collection;
  private final CatalogProperties properties;
  private final CatalogSourceRegistry registry;
  private final CatalogJson json;
  private final CatalogTime time;
  private final CatalogResultMapper results;
  private final TransactionTemplate tx;

  public SearchResponse search(SearchRequest request) {
    long userId = AuthContext.requireUserId();
    var command = CatalogText.command(request);
    Query query = collection.submit(command, userId);
    // Pin query revision while selecting IDs and publishing its snapshot. No external I/O here.
    return tx.execute(status -> build(command, queries.lock(query.getId()), userId));
  }

  private SearchResponse build(CatalogText.Command command, Query query, long userId) {
    var now = time.now();
    Map<Long, Book> found = new LinkedHashMap<>();
    for (String keyword : CatalogRelevance.lookupKeywords(command.keyword())) {
      String prefix = keyword.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
      books
          .prefix(command.isbn13(), prefix, query.isTestData(), now)
          .forEach(b -> found.put(b.getId(), b));
      if (command.keyword().codePointCount(0, command.keyword().length()) >= 2)
        books.fulltext(keyword, query.isTestData(), now).forEach(b -> found.put(b.getId(), b));
    }
    var hits = results.hits(query.getId(), query.getGeneration());
    var cached = new ArrayList<>(json.ids(query.getCachedBookIds()));
    hits.forEach(
        hit -> {
          if (!cached.contains(hit.catalogBookId())) cached.add(hit.catalogBookId());
        });
    Map<Long, Integer> providerRanks = new HashMap<>();
    for (int i = 0; i < cached.size(); i++) providerRanks.putIfAbsent(cached.get(i), i);
    hits.forEach(hit -> providerRanks.put(hit.catalogBookId(), hit.sourceRank()));
    if (!cached.isEmpty())
      books.books(cached, query.isTestData(), now).forEach(b -> found.put(b.getId(), b));
    var resolved = projection.resolve(List.copyOf(found.values()), now);
    var ranked =
        found.values().stream()
            .filter(b -> resolved.containsKey(b.getId()))
            .filter(
                b ->
                    CatalogRelevance.matches(
                        resolved.get(b.getId()).data(),
                        command,
                        providerRanks.containsKey(b.getId())))
            .sorted(
                Comparator.comparingInt(
                        (Book b) ->
                            CatalogRelevance.match(
                                    resolved.get(b.getId()).data(),
                                    command,
                                    providerRanks.containsKey(b.getId()))
                                .ordinal())
                    .thenComparingInt(b -> providerRanks.getOrDefault(b.getId(), Integer.MAX_VALUE))
                    .thenComparingLong(Book::getId))
            .toList();
    Snapshot snapshot = new Snapshot();
    snapshot.setPublicId(UUID.randomUUID().toString());
    snapshot.setQueryEntryId(query.getId());
    snapshot.setGeneration(query.getGeneration());
    snapshot.setResultVersion(query.getResultVersion());
    snapshot.setQueryField(command.field().name());
    snapshot.setLanguageFilter(command.language());
    snapshot.setFormatFilter(command.format().name());
    snapshot.setRankingVersion(RANKING_VERSION);
    snapshot.setRankedBooks(json.write(ranked.stream().limit(200).map(Book::getId).toList()));
    snapshot.setTruncated(
        ranked.size() > 1000
            || collection.outcomes(query).values().stream()
                .anyMatch(CatalogCollectionBusiness.Outcome::more));
    snapshot.setExpiresAt(now.plusMinutes(15));
    snapshot.setTestData(query.isTestData());
    queries.insertSnapshot(snapshot);
    var items = new ArrayList<CatalogResultMapper.Item>();
    for (int i = 0; i < Math.min(1000, ranked.size()); i++) {
      long id = ranked.get(i).getId();
      items.add(
          new CatalogResultMapper.Item(
              id,
              i,
              CatalogRelevance.match(
                      resolved.get(id).data(), command, providerRanks.containsKey(id))
                  .name()));
    }
    if (!items.isEmpty()) results.items(snapshot.getId(), items, query.isTestData());
    return page(snapshot, 0, command.limit(), query, userId);
  }

  public SearchResponse next(String id, String cursor, int limit) {
    long userId = AuthContext.requireUserId();
    if (limit < 1 || limit > 40) throw invalid();
    Snapshot snapshot = queries.snapshot(id, properties.isTestData());
    if (snapshot == null || !snapshot.getExpiresAt().isAfter(time.now()))
      throw new ApiException(ApiErrorCode.CATALOG_SNAPSHOT_EXPIRED);
    return page(
        snapshot,
        cursor == null ? 0 : offset(id, cursor),
        limit,
        queries.find(snapshot.getQueryEntryId()),
        userId);
  }

  private SearchResponse page(Snapshot snapshot, int offset, int limit, Query query, long userId) {
    var ids = json.ids(snapshot.getRankedBooks());
    boolean relational = ROW_RANKING_VERSIONS.contains(snapshot.getRankingVersion());
    int count = relational ? results.count(snapshot.getId()) : ids.size();
    if (offset < 0 || offset > count) throw invalid();
    int end = Math.min(offset + limit, count);
    var pageIds =
        relational ? results.page(snapshot.getId(), offset, limit) : ids.subList(offset, end);
    var candidates = candidates(pageIds, snapshot.isTestData(), userId);
    var state = collection.status(query);
    String freshness =
        query.getRevalidateAfter() == null
            ? "UNKNOWN"
            : query.getRevalidateAfter().isAfter(time.now()) ? "FRESH" : "STALE";
    String resultState =
        !candidates.isEmpty()
            ? "RESULTS"
            : state.state().equals("COLLECTING")
                ? "COLLECTING"
                : Set.of("FAILED", "DEFERRED", "NONE").contains(state.lastOutcome())
                    ? "UNAVAILABLE"
                    : "EMPTY";
    return new SearchResponse(
        snapshot.getPublicId(),
        snapshot.getResultVersion(),
        candidates,
        resultState,
        freshness,
        end < count ? cursor(snapshot.getPublicId(), end) : null,
        count,
        snapshot.isTruncated(),
        state,
        state.lastUpdatedAt(),
        state.revalidateAfter());
  }

  public List<Candidate> candidates(List<Long> ids, boolean testData, long userId) {
    if (ids.isEmpty()) return List.of();
    registry.initialize();
    var now = time.now();
    var rows = books.books(ids, testData, now);
    var resolved = projection.resolve(rows, now);
    var coverIds =
        rows.stream().map(Book::getCoverAssetId).filter(Objects::nonNull).distinct().toList();
    Map<Long, Cover> coverMap =
        coverIds.isEmpty()
            ? Map.of()
            : covers.permittedList(coverIds, now).stream()
                .collect(Collectors.toMap(Cover::getId, Function.identity()));
    var isbns = new ArrayList<String>();
    resolved
        .values()
        .forEach(
            r -> {
              if (r.data().isbn13() != null) {
                isbns.add(r.data().isbn13());
                String ten = isbn10(r.data().isbn13());
                if (ten != null) isbns.add(ten);
              }
            });
    var matches = library.matches(userId, ids, isbns);
    var coverStates =
        books.records(ids).stream()
            .filter(r -> r.getStatus().equals("ACTIVE"))
            .collect(
                Collectors.toMap(
                    SourceRecord::getCatalogBookId,
                    SourceRecord::getCoverStatus,
                    (a, b) -> a.equals("PENDING") || b.equals("PENDING") ? "PENDING" : a));
    Map<Long, Candidate> result = new HashMap<>();
    for (var row : rows) {
      var r = resolved.get(row.getId());
      if (r == null) continue;
      Long saved =
          matches.stream()
              .filter(
                  m ->
                      row.getId().equals(m.catalogBookId())
                          || (r.data().isbn13() != null
                              && r.data().isbn13().equals(CatalogText.isbn13(m.isbn()))))
              .map(CatalogLibraryMapper.Match::id)
              .findFirst()
              .orElse(null);
      String coverState = coverStates.getOrDefault(row.getId(), "MISSING");
      result.put(
          row.getId(),
          projection.candidate(
              row,
              r,
              row.getCoverAssetId() == null ? null : coverMap.get(row.getCoverAssetId()),
              saved,
              coverState.equals("READY") ? "MISSING" : coverState));
    }
    return ids.stream().map(result::get).filter(Objects::nonNull).toList();
  }

  public Candidate detail(long id) {
    return candidates(List.of(id), properties.isTestData(), AuthContext.requireUserId()).stream()
        .findFirst()
        .orElseThrow(() -> new ApiException(ApiErrorCode.COMMON_NOT_FOUND));
  }

  public CollectionStatus status(String id) {
    AuthContext.requireUserId();
    Query query = queries.findPublic(id, properties.isTestData());
    if (query == null) throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND);
    return collection.status(query);
  }

  private String cursor(String id, int offset) {
    String payload = id + ":" + offset;
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(
            (payload
                    + ":"
                    + CatalogText.hex(CatalogText.key(queries.hmacKey(), "cursor:" + payload)))
                .getBytes(StandardCharsets.UTF_8));
  }

  private int offset(String id, String cursor) {
    try {
      if (cursor == null || cursor.length() > 300) throw invalid();
      String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      String[] parts = decoded.split(":");
      if (parts.length != 3 || !parts[0].equals(id)) throw invalid();
      int offset = Integer.parseInt(parts[1]);
      if (!MessageDigest.isEqual(
          cursor(id, offset).getBytes(StandardCharsets.US_ASCII),
          cursor.getBytes(StandardCharsets.US_ASCII))) throw invalid();
      return offset;
    } catch (IllegalArgumentException ex) {
      throw invalid();
    }
  }

  public static String isbn10(String isbn) {
    if (isbn == null || !isbn.startsWith("978")) return null;
    String base = isbn.substring(3, 12);
    int sum = 0;
    for (int i = 0; i < 9; i++) sum += (10 - i) * (base.charAt(i) - '0');
    int check = (11 - sum % 11) % 11;
    return base + (check == 10 ? "X" : Integer.toString(check));
  }

  private ApiException invalid() {
    return new ApiException(ApiErrorCode.COMMON_VALIDATION_FAILED);
  }
}
