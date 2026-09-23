package com.margins.book.catalog.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.*;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Data
@Component
@Validated
@ConfigurationProperties(prefix = "margins.catalog")
public class CatalogProperties {
  private boolean enabled = true;
  private boolean workerEnabled = true;
  private boolean testData = false;
  private String userAgent = "MarginsBookCatalog/1.0 (+https://margins.cloud)";

  @Min(1)
  @Max(45)
  private int requestTimeoutSeconds = 10;

  @Min(1)
  @Max(45)
  private int openLibraryTimeoutSeconds = 25;

  @Min(1)
  @Max(45)
  private int coverTimeoutSeconds = 10;

  public int timeoutSeconds(String source, boolean cover) {
    return cover
        ? coverTimeoutSeconds
        : "open_library".equals(source) ? openLibraryTimeoutSeconds : requestTimeoutSeconds;
  }

  private String googleApiKey = "", kakaoApiKey = "", nlApiKey = "";
  private String naverClientId = "", naverClientSecret = "";
  private Set<String> metadataSources =
      new HashSet<>(
          List.of(
              "open_library", "google_books", "kakao_books", "nl_seoji", "naver_books"));

  /**
   * Explicit operator assertion of thumbnail storage/republication permission; default is fail
   * closed.
   */
  private Set<String> coverSources = new HashSet<>();

  /** Activating an HTML adapter requires explicit review, not just a missing API key. */
  private Set<String> htmlSources = new HashSet<>();

  private Set<Long> operatorUserIds = new HashSet<>();
}
