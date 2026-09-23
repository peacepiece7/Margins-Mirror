package com.margins.book.catalog.business;

import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.model.CatalogRows.*;
import com.margins.book.catalog.provider.*;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Called only inside a fenced collection completion transaction. Network/decode must happen
 * earlier.
 */
@Component
@RequiredArgsConstructor
public class CatalogIngestBusiness {
  private final CatalogBookMapper mapper;
  private final CatalogJobMapper jobs;
  private final CatalogProjection projection;
  private final CatalogSourceRegistry registry;
  private final CatalogJson json;

  public long upsert(Source source, NormalizedBook data, Job job, LocalDateTime now) {
    if (!CatalogSourceRegistry.allowed(source, now, false)) throw new SourceFailure("BLOCKED");
    data = permitted(source, data, now);
    CatalogUrlPolicy.validate(source.getCode(), URI.create(data.sourceUrl()));
    SourceRecord record = mapper.record(source.getId(), data.externalId(), job.isTestData());
    Book book = record == null ? null : mapper.lockBook(record.getCatalogBookId());
    if (book != null && !"ACTIVE".equals(book.getStatus())) return 0;
    if (book != null
        && ((book.getIsbn13() != null
                && data.isbn13() != null
                && !book.getIsbn13().equals(data.isbn13()))
            || conflictingFormat(book.getFormat(), data.format()))) {
      mapper.conflict(record.getId());
      return 0;
    }
    if (book != null && book.getIsbn13() == null && data.isbn13() != null) {
      Book existing = mapper.isbn(data.isbn13(), job.isTestData());
      // Never merge previously addressable editions or private library links automatically.
      if (existing != null && !existing.getId().equals(book.getId())) {
        mapper.conflict(record.getId());
        return 0;
      }
      mapper.identify(book.getId(), data.isbn13());
      book.setIsbn13(data.isbn13());
    }
    if (book == null) {
      book = new Book();
      book.setIsbn13(data.isbn13());
      book.setTitle(data.title());
      book.setSubtitle(data.subtitle());
      book.setAuthorsDisplay(data.author());
      book.setTitleNormalized(CatalogText.normalize(data.title()));
      book.setAuthorsNormalized(CatalogText.normalize(data.author()));
      book.setFormat(data.format());
      book.setFieldProvenance("{}");
      book.setStatus("ACTIVE");
      book.setMetadataCheckedAt(now);
      book.setTestData(job.isTestData());
      mapper.insertBook(book);
      book = mapper.lockBook(book.getId());
      if (!"ACTIVE".equals(book.getStatus())) return 0;
      if (conflictingFormat(book.getFormat(), data.format())) return 0;
    }
    boolean fresh = record != null && record.getFetchedAt().plusDays(30).isAfter(now);
    if (record == null) {
      record = new SourceRecord();
      record.setCatalogBookId(book.getId());
      record.setSourceId(source.getId());
      record.setExternalId(data.externalId());
      record.setTestData(job.isTestData());
      record.setCoverStatus("MISSING");
    }
    record.setSourceUrl(data.sourceUrl());
    record.setSourceKind("EDITION");
    record.setNormalizedPayload(json.write(data));
    record.setPayloadSha256(CatalogText.hash(record.getNormalizedPayload()));
    record.setParserVersion("v1");
    record.setPolicyVersion(source.getPolicyVersion());
    record.setStatus("ACTIVE");
    record.setFetchedAt(now);
    record.setExpiresAt(
        source.getMetadataTtlSeconds() == null
            ? null
            : now.plusSeconds(source.getMetadataTtlSeconds()));
    if (record.getId() == null) mapper.insertRecord(record);
    else mapper.updateRecord(record);
    Map<Long, Source> sources = new HashMap<>();
    registry.sources().forEach(s -> sources.put(s.getId(), s));
    var resolved = projection.resolve(book, mapper.records(List.of(book.getId())), sources, now);
    if (resolved.isEmpty()) return 0;
    projection.write(book, resolved.get(), now);
    if (!fresh
        && data.coverUrl() != null
        && !data.coverUrl().isBlank()
        && CatalogSourceRegistry.allowed(source, now, true)) {
      try {
        CatalogUrlPolicy.validate(source.getCode(), URI.create(data.coverUrl()));
        Job cover = new Job();
        cover.setSourceId(source.getId());
        cover.setQueryEntryId(job.getQueryEntryId());
        cover.setSourceRecordId(record.getId());
        cover.setGeneration(job.getGeneration());
        cover.setKind("FETCH_COVER");
        cover.setDedupeKey(
            CatalogText.hash(
                "cover:" + source.getId() + ":" + record.getId() + ":" + job.isTestData()));
        cover.setAvailableAt(now);
        cover.setDeadlineAt(job.getDeadlineAt());
        cover.setTestData(job.isTestData());
        jobs.insert(cover);
        mapper.coverStatus(record.getId(), "PENDING");
      } catch (IllegalArgumentException | SourceFailure ex) {
        mapper.coverStatus(record.getId(), "DENIED");
      }
    }
    return book.getId();
  }

  private boolean conflictingFormat(String a, String b) {
    return a != null && b != null && !a.equals("UNKNOWN") && !b.equals("UNKNOWN") && !a.equals(b);
  }

  private NormalizedBook permitted(Source source, NormalizedBook d, LocalDateTime now) {
    Set<String> fields = json.fields(source.getApprovedFields());
    if (!fields.contains("title")) throw new SourceFailure("POLICY_DENIED");
    return new NormalizedBook(
        d.externalId(),
        d.sourceUrl(),
        d.title(),
        fields.contains("subtitle") ? d.subtitle() : null,
        fields.contains("authors") ? d.authors() : List.of(),
        fields.contains("isbn13") ? d.isbn13() : null,
        fields.contains("publisher") ? d.publisher() : null,
        fields.contains("publishedDate") ? d.publishedDate() : null,
        fields.contains("language") ? d.language() : null,
        fields.contains("format") ? d.format() : null,
        fields.contains("pageCount") ? d.pageCount() : null,
        fields.contains("description") ? d.description() : null,
        CatalogSourceRegistry.allowed(source, now, true) ? d.coverUrl() : null,
        fields.contains("editionStatement") ? d.editionStatement() : null,
        fields.contains("contributors") ? d.contributors() : List.of(),
        fields.contains("setIsbn13") ? d.setIsbn13() : null,
        fields.contains("plannedPublicationDate") ? d.plannedPublicationDate() : null);
  }
}
