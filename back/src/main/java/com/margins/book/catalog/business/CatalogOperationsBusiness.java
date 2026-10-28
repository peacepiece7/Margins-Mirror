package com.margins.book.catalog.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.*;
import com.margins.book.catalog.provider.*;
import com.margins.common.error.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
public class CatalogOperationsBusiness {
  private final CatalogProperties properties;
  private final CatalogSourceRegistry registry;
  private final CatalogSourceMapper sources;
  private final CatalogJobMapper jobs;
  private final CatalogCoverMapper covers;
  private final CatalogCoverBusiness coverBusiness;
  private final CatalogTime time;
  private final TransactionTemplate tx;

  public boolean operator() {
    return properties.getOperatorUserIds().contains(AuthContext.requireUserId());
  }

  public void requireOperator() {
    if (!operator()) throw new ApiException(ApiErrorCode.COMMON_FORBIDDEN);
  }

  public Operations read() {
    requireOperator();
    var rows = registry.sources();
    var statuses =
        rows.stream()
            .map(
                s ->
                    new SourceStatus(
                        s.getId(),
                        s.getCode(),
                        s.getDisplayName(),
                        s.getAdapterType(),
                        s.getStatus(),
                        registry.readiness(s),
                        s.getMetadataPolicy(),
                        s.getCoverPolicy(),
                        s.getRequestsToday(),
                        s.getDailyRequestLimit(),
                        CatalogTime.instant(s.getBackoffUntil()),
                        s.getPolicyReference()))
            .toList();
    Map<Long, String> codes = new HashMap<>();
    rows.forEach(s -> codes.put(s.getId(), s.getCode()));
    var recent =
        jobs.recent().stream()
            .filter(j -> codes.containsKey(j.getSourceId()))
            .map(
                j ->
                    new JobStatus(
                        j.getId(),
                        codes.get(j.getSourceId()),
                        j.getKind(),
                        j.getState(),
                        j.getAttemptCount(),
                        CatalogTime.instant(j.getAvailableAt()),
                        CatalogTime.instant(j.getDeadlineAt()),
                        j.getSafeErrorCode()))
            .toList();
    var budget = covers.budget();
    return new Operations(
        statuses, recent, budget.getUsedBytes(), budget.getLimitBytes(), 80, covers.count());
  }

  public void source(long id, SourceAction action) {
    requireOperator();
    registry.initialize();
    tx.executeWithoutResult(
        status -> {
          var source = sources.lock(id);
          if (source == null || source.isTestData() != properties.isTestData())
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND);
          if (action.action().equals("RESUME")
              && (!registry.readiness(source).equals("READY")
                  || source.getStatus().equals("REVOKED")))
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT);
          // Do not take query/job locks here: a worker completion locks query -> job -> source.
          // The live policy fence will discard in-flight writes. Pausing is immediately effective
          // for reads.
          sources.status(id, action.action().equals("PAUSE") ? "PAUSED" : "ACTIVE");
        });
  }

  public void withdraw(long id) {
    requireOperator();
    var cover = covers.metadata(id);
    if (cover == null || cover.isTestData() != properties.isTestData())
      throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND);
    coverBusiness.withdraw(id, true);
  }
}
