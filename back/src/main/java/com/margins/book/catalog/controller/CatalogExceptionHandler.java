package com.margins.book.catalog.controller;

import com.margins.book.catalog.business.CatalogRateLimitException;
import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

/**
 * SQL/provider payloads are never rendered or logged through the generic unexpected-error handler.
 */
@Slf4j
@Order(-10)
@RestControllerAdvice(basePackageClasses = CatalogController.class)
public class CatalogExceptionHandler {
  @ExceptionHandler(DataAccessException.class)
  public ResponseEntity<ApiResponse<Void>> database(DataAccessException exception) {
    log.warn("Catalog database unavailable. type={}", exception.getClass().getSimpleName());
    return ResponseEntity.status(503)
        .cacheControl(CacheControl.noStore())
        .body(ApiResponse.failed(ApiErrorCode.COMMON_SERVICE_UNAVAILABLE));
  }

  @ExceptionHandler(CatalogRateLimitException.class)
  public ResponseEntity<ApiResponse<Void>> rate(CatalogRateLimitException exception) {
    return ResponseEntity.status(429)
        .cacheControl(CacheControl.noStore())
        .header("Retry-After", Long.toString(exception.retryAfterSeconds()))
        .body(ApiResponse.failed(ApiErrorCode.COMMON_RATE_LIMITED));
  }
}
