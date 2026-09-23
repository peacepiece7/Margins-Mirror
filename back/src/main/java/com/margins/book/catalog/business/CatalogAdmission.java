package com.margins.book.catalog.business;

import com.margins.common.error.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;

/** Local ingress protection complements durable provider quotas. No raw keyword is retained. */
@Component
public class CatalogAdmission {
  private record Window(LocalDate day, long minute, int daily, int minutely) {}

  private final Map<Long, Window> windows = new HashMap<>();

  public synchronized void admit(long userId, LocalDateTime now) {
    long minute = now.toEpochSecond(ZoneOffset.UTC) / 60;
    windows.entrySet().removeIf(e -> !e.getValue().day().equals(now.toLocalDate()));
    Window prior = windows.get(userId);
    int daily = prior == null ? 0 : prior.daily();
    int minutely = prior == null || prior.minute() != minute ? 0 : prior.minutely();
    if (daily >= 100 || minutely >= 10 || (prior == null && windows.size() >= 10000))
      throw new CatalogRateLimitException(
          daily >= 100
              ? Duration.between(now, now.toLocalDate().plusDays(1).atStartOfDay()).toSeconds()
              : 60 - now.getSecond());
    windows.put(userId, new Window(now.toLocalDate(), minute, daily + 1, minutely + 1));
  }
}
