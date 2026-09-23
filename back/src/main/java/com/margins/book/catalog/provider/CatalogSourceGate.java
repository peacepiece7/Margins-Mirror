package com.margins.book.catalog.provider;

import com.margins.book.catalog.mapper.CatalogSourceMapper;
import java.time.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class CatalogSourceGate {
  private final CatalogSourceMapper mapper;

  /** Reserve quota atomically, release DB locks, and only then wait/connect in the HTTP caller. */
  @Transactional
  public long reserve(long id, boolean cover, LocalDateTime now) {
    var source = mapper.lock(id);
    if (!CatalogSourceRegistry.allowed(source, now, cover)) throw new SourceFailure("BLOCKED");
    if (source.getBackoffUntil() != null && source.getBackoffUntil().isAfter(now))
      throw SourceFailure.deferred(
          (int) Duration.between(now, source.getBackoffUntil()).toSeconds() + 1);
    int count = now.toLocalDate().equals(source.getQuotaDate()) ? source.getRequestsToday() : 0;
    if (count >= source.getDailyRequestLimit())
      throw SourceFailure.deferred(
          (int) Duration.between(now, now.toLocalDate().plusDays(1).atStartOfDay()).toSeconds());
    LocalDateTime reserved =
        source.getNextRequestAt() != null && source.getNextRequestAt().isAfter(now)
            ? source.getNextRequestAt()
            : now;
    long wait = Duration.between(now, reserved).toMillis();
    if (wait > 5000) throw SourceFailure.deferred((int) (wait / 1000) + 1);
    mapper.reserve(
        id, now, reserved.plusNanos((long) source.getMinIntervalMs() * 1000000), count + 1);
    return Math.max(0, wait);
  }
}
