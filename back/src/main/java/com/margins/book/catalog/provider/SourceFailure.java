package com.margins.book.catalog.provider;

/**
 * Safe, enumerable upstream failure. Never includes URL, credentials, query, HTML, or exception
 * cause.
 */
public class SourceFailure extends RuntimeException {
  private final String code;
  private final int retryAfterSeconds;
  private final boolean localDeferral;

  public SourceFailure(String code) {
    this(code, 60);
  }

  public SourceFailure(String code, int retryAfterSeconds) {
    this(code, retryAfterSeconds, false);
  }

  private SourceFailure(String code, int retryAfterSeconds, boolean localDeferral) {
    super(code);
    this.code = code;
    this.retryAfterSeconds = Math.max(1, Math.min(retryAfterSeconds, 86400));
    this.localDeferral = localDeferral;
  }

  /** No upstream request was made. Keep the public safe code, distinguish internal scheduling. */
  public static SourceFailure deferred(int retryAfterSeconds) {
    return new SourceFailure("RATE_LIMITED", retryAfterSeconds, true);
  }

  public boolean localDeferral() {
    return localDeferral;
  }

  public String code() {
    return code;
  }

  public int retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
