package com.margins.book.catalog.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class CatalogDto {
  private CatalogDto() {}

  public enum Field {
    ALL,
    TITLE,
    AUTHOR,
    ISBN
  }

  public enum Format {
    ALL,
    PRINT,
    EBOOK,
    AUDIOBOOK
  }

  public enum Intent {
    SUBMIT,
    REBUILD,
    EXTEND
  }

  public record SearchRequest(
      @NotBlank @Size(max = 400) String query,
      Field field,
      @Pattern(regexp = "ALL|ko|en") String language,
      Format format,
      @Min(1) @Max(40) Integer limit,
      Intent intent) {
    public SearchRequest {
      field = field == null ? Field.ALL : field;
      language = language == null ? "ALL" : language;
      format = format == null ? Format.ALL : format;
      limit = limit == null ? 20 : limit;
      intent = intent == null ? Intent.SUBMIT : intent;
    }
  }

  public record SaveRequest(@NotNull @Positive Long catalogBookId) {}

  public record SourceLink(String code, String label, String url) {}

  public record Candidate(
      String candidateId,
      Long catalogBookId,
      String title,
      String subtitle,
      String author,
      List<String> authors,
      String isbn,
      String isbn13,
      String publisher,
      String publishedDate,
      Integer publishedYear,
      String language,
      String format,
      Integer pageCount,
      String description,
      String thumbnail,
      String coverStatus,
      boolean inLibrary,
      Long savedBookId,
      List<SourceLink> sources) {}

  public record CollectionStatus(
      String id,
      String state,
      String lastOutcome,
      int generation,
      int resultVersion,
      int coverVersion,
      boolean canExtend,
      int succeededSourceCount,
      int failedSourceCount,
      Integer retryAfterSeconds,
      Instant lastUpdatedAt,
      Instant revalidateAfter) {}

  public record SearchResponse(
      String snapshotId,
      int appliedResultVersion,
      List<Candidate> candidates,
      String resultState,
      String freshness,
      String nextCursor,
      int visibleCount,
      boolean truncated,
      CollectionStatus collection,
      Instant lastUpdatedAt,
      Instant revalidateAfter) {}

  public record SourceStatus(
      long id,
      String code,
      String label,
      String adapterType,
      String state,
      String readiness,
      String metadataPolicy,
      String coverPolicy,
      int requestsToday,
      int dailyLimit,
      Instant backoffUntil,
      String policyReference) {}

  public record JobStatus(
      long id,
      String source,
      String kind,
      String state,
      int attempts,
      Instant availableAt,
      Instant deadlineAt,
      String errorCode) {}

  public record Operations(
      List<SourceStatus> sources,
      List<JobStatus> jobs,
      long usedBytes,
      long limitBytes,
      int warningPercent,
      long coverCount) {}

  public record SourceAction(@NotBlank @Pattern(regexp = "PAUSE|RESUME") String action) {}

  public record Capabilities(boolean operator) {}
}
