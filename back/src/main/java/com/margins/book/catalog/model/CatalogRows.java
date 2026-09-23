package com.margins.book.catalog.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Data;

/** Persistence-only rows. No image bytes or query text is exposed by API serialization. */
public final class CatalogRows {
  private CatalogRows() {}

  @Data
  public static class Source {
    private Long id;
    private String code, displayName, adapterType, status, metadataPolicy, coverPolicy;
    private String policyReference, approvedFields;
    private Integer metadataTtlSeconds, coverTtlSeconds;
    private int policyVersion,
        priority,
        minIntervalMs,
        dailyRequestLimit,
        requestsToday,
        consecutiveFailures;
    private LocalDate quotaDate;
    private LocalDateTime policyExpiresAt, nextRequestAt, backoffUntil;
    private boolean testData;
  }

  @Data
  public static class Book {
    private Long id, coverAssetId;
    private String isbn13, title, subtitle, authorsDisplay, titleNormalized, authorsNormalized;
    private String publisher,
        publishedDateText,
        languageCode,
        format,
        description,
        fieldProvenance,
        status;
    private Integer pageCount;
    private LocalDateTime metadataCheckedAt, expiresAt;
    private boolean testData;
    // Metadata-only cover projection; never a BLOB.
    private String coverHash;
  }

  @Data
  public static class SourceRecord {
    private Long id, catalogBookId, sourceId;
    private String externalId,
        sourceUrl,
        sourceKind,
        normalizedPayload,
        parserVersion,
        status,
        coverStatus;
    private byte[] payloadSha256;
    private int policyVersion;
    private LocalDateTime fetchedAt, expiresAt;
    private boolean testData;
  }

  @Data
  public static class Query {
    private Long id;
    private String publicId, queryText, lastOutcome, cachedBookIds, sourceOutcomes;
    private byte[] queryKey;
    private int keyVersion, generation, resultVersion, coverVersion;
    private LocalDateTime textExpiresAt, lastCollectedAt, revalidateAfter, retryAfter, retireAfter;
    private boolean testData;
  }

  @Data
  public static class Snapshot {
    private Long id, queryEntryId;
    private String publicId, queryField, languageFilter, formatFilter, rankingVersion, rankedBooks;
    private int generation, resultVersion;
    private boolean truncated, testData;
    private LocalDateTime expiresAt;
  }

  @Data
  public static class Job {
    private Long id, sourceId, queryEntryId, sourceRecordId;
    private int generation, attemptCount;
    private int pageNumber = 1;
    private String kind, state, leaseToken, safeErrorCode;
    private byte[] dedupeKey;
    private LocalDateTime availableAt, leaseUntil, deadlineAt, createdAt, finishedAt;
    private boolean testData;
  }

  @Data
  public static class Cover {
    private Long id, sourceRecordId;
    private byte[] sha256, imageBytes;
    private String sourceUrl, mimeType, status;
    private int width, height, byteSize, policyVersion;
    private LocalDateTime fetchedAt, expiresAt;
    private boolean testData;
  }

  @Data
  public static class Budget {
    private long limitBytes, usedBytes;
  }
}
