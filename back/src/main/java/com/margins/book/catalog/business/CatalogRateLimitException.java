package com.margins.book.catalog.business;

import com.margins.common.error.*;

public class CatalogRateLimitException extends ApiException {
  private final long retryAfterSeconds;

  public CatalogRateLimitException(long seconds) {
    super(ApiErrorCode.COMMON_RATE_LIMITED);
    retryAfterSeconds = Math.max(1, seconds);
  }

  public long retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
