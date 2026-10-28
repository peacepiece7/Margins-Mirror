package com.margins.book.catalog.business;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CatalogProjection {
  private final CatalogBookMapper mapper;
  private final CatalogCoverMapper covers;
  private final CatalogSourceRegistry registry;
  private final CatalogJson json;
  private final ObjectMapper objectMapper;

  public record Resolved(NormalizedBook data, String provenance, List<SourceLink> sources) {}

  private record Origin(SourceRecord row, Source source, NormalizedBook data, Set<String> fields) {}

  public Optional<Resolved> resolve(
      Book book, List<SourceRecord> records, Map<Long, Source> sources, LocalDateTime now) {
    List<Origin> active = new ArrayList<>();
    for (var record : records) {
      var source = sources.get(record.getSourceId());
      if (record.isTestData() != book.isTestData()
          || !record.getCatalogBookId().equals(book.getId())
          || !"ACTIVE".equals(record.getStatus())
          || !CatalogSourceRegistry.allowed(source, now, false)
          || source.getPolicyVersion() != record.getPolicyVersion()
          || (record.getExpiresAt() != null && !record.getExpiresAt().isAfter(now))) continue;
      try {
        NormalizedBook data = json.read(record.getNormalizedPayload(), NormalizedBook.class);
        CatalogUrlPolicy.validate(source.getCode(), URI.create(data.sourceUrl()));
        Set<String> fields = new HashSet<>();
        objectMapper.readTree(source.getApprovedFields()).forEach(n -> fields.add(n.asText()));
        active.add(new Origin(record, source, data, fields));
      } catch (Exception ignored) {
        /* A malformed/withdrawn origin is never exposed through a stale projection. */
      }
    }
    active.sort(
        Comparator.comparingInt((Origin o) -> o.source().getPriority())
            .thenComparingLong(o -> o.row().getId()));
    if (active.isEmpty()) return Optional.empty();
    Map<String, Long> provenance = new LinkedHashMap<>();
    String title = value(active, "title", NormalizedBook::title, provenance);
    if (title == null) return Optional.empty();
    Origin first = active.getFirst();
    List<String> authors =
        active.stream()
            .filter(o -> o.fields().contains("authors") && !o.data().authors().isEmpty())
            .findFirst()
            .map(
                o -> {
                  provenance.put("authors", o.row().getId());
                  return o.data().authors();
                })
            .orElse(List.of());
    Integer pages =
        active.stream()
            .filter(o -> o.fields().contains("pageCount") && o.data().pageCount() != null)
            .findFirst()
            .map(
                o -> {
                  provenance.put("pageCount", o.row().getId());
                  return o.data().pageCount();
                })
            .orElse(null);
    var data =
        new NormalizedBook(
            first.data().externalId(),
            first.data().sourceUrl(),
            title,
            value(active, "subtitle", NormalizedBook::subtitle, provenance),
            authors,
            value(active, "isbn13", NormalizedBook::isbn13, provenance),
            value(active, "publisher", NormalizedBook::publisher, provenance),
            value(active, "publishedDate", NormalizedBook::publishedDate, provenance),
            value(active, "language", NormalizedBook::language, provenance),
            value(
                active,
                "format",
                o -> "UNKNOWN".equals(o.format()) ? null : o.format(),
                provenance),
            pages,
            value(active, "description", NormalizedBook::description, provenance),
            null,
            value(active, "editionStatement", NormalizedBook::editionStatement, provenance));
    List<SourceLink> links =
        active.stream()
            .map(
                o ->
                    new SourceLink(
                        o.source().getCode(), o.source().getDisplayName(), o.data().sourceUrl()))
            .distinct()
            .toList();
    return Optional.of(new Resolved(data, json.write(provenance), links));
  }

  private String value(
      List<Origin> origins,
      String field,
      Function<NormalizedBook, String> getter,
      Map<String, Long> provenance) {
    for (var origin : origins) {
      String result = getter.apply(origin.data());
      if (origin.fields().contains(field) && result != null && !result.isBlank()) {
        provenance.put(field, origin.row().getId());
        return result;
      }
    }
    return null;
  }

  public Map<Long, Resolved> resolve(List<Book> books, LocalDateTime now) {
    if (books.isEmpty()) return Map.of();
    List<Long> ids = books.stream().map(Book::getId).toList();
    var records =
        mapper.records(ids).stream().collect(Collectors.groupingBy(SourceRecord::getCatalogBookId));
    var sources =
        registry.sources().stream().collect(Collectors.toMap(Source::getId, Function.identity()));
    Map<Long, Resolved> result = new LinkedHashMap<>();
    for (var book : books)
      resolve(book, records.getOrDefault(book.getId(), List.of()), sources, now)
          .ifPresent(r -> result.put(book.getId(), r));
    return result;
  }

  public Candidate candidate(
      Book book, Resolved resolved, Cover cover, Long savedBookId, String coverStatus) {
    var d = resolved.data();
    String thumbnail = cover == null ? null : coverPath(cover);
    Integer year =
        d.publishedDate() == null ? null : Integer.valueOf(d.publishedDate().substring(0, 4));
    return new Candidate(
        "catalog:" + book.getId(),
        book.getId(),
        d.title(),
        d.subtitle(),
        d.author(),
        d.authors(),
        d.isbn13(),
        d.isbn13(),
        d.publisher(),
        d.publishedDate(),
        year,
        d.language(),
        d.format(),
        d.pageCount(),
        d.description(),
        thumbnail,
        cover == null ? coverStatus : "READY",
        savedBookId != null,
        savedBookId,
        resolved.sources());
  }

  public static String coverPath(Cover cover) {
    return "/api/catalog/covers/" + cover.getId() + "/" + CatalogText.hex(cover.getSha256());
  }

  public void write(Book book, Resolved resolved, LocalDateTime now) {
    var d = resolved.data();
    book.setTitle(d.title());
    book.setSubtitle(d.subtitle());
    book.setAuthorsDisplay(d.author());
    book.setTitleNormalized(CatalogText.normalize(d.title()));
    book.setAuthorsNormalized(CatalogText.normalize(d.author()));
    book.setPublisher(d.publisher());
    book.setPublishedDateText(d.publishedDate());
    book.setLanguageCode(d.language());
    book.setFormat(d.format());
    book.setPageCount(d.pageCount());
    book.setDescription(d.description());
    book.setFieldProvenance(resolved.provenance());
    book.setMetadataCheckedAt(now);
    book.setStatus("ACTIVE");
    // All public responses resolve live origins; a source TTL never extends by updating this index
    // projection.
    book.setExpiresAt(null);
    mapper.project(book);
  }
}
