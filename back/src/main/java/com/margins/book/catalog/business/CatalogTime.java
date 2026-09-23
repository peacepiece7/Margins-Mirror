package com.margins.book.catalog.business;

import java.time.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class CatalogTime {
  private final Clock clock;

  @Autowired
  public CatalogTime() {
    this(Clock.systemUTC());
  }

  public CatalogTime(Clock clock) {
    this.clock = clock;
  }

  public LocalDateTime now() {
    return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  public static Instant instant(LocalDateTime value) {
    return value == null ? null : value.toInstant(ZoneOffset.UTC);
  }
}
