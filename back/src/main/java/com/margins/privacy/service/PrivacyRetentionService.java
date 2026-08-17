package com.margins.privacy.service;

import com.margins.privacy.mapper.PrivacyRetentionMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class PrivacyRetentionService {
    private final PrivacyRetentionMapper mapper;
    private final Environment environment;
    private final TransactionTemplate transactionTemplate;

    @Scheduled(cron = "0 15 * * * *")
    @Transactional
    public RetentionResult runMaintenance() {
        RetentionResult result = executeAt(Instant.now());
        log.info("Privacy retention maintenance completed. deletedRows={}", result);
        return result;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void runStartupMaintenance() {
        if (!environment.acceptsProfiles(Profiles.of("test"))) {
            RetentionResult result = transactionTemplate.execute(status -> executeAt(Instant.now()));
            log.info("Privacy retention startup maintenance completed. deletedRows={}", result);
        }
    }

    @Transactional
    public RetentionResult runMaintenanceAt(Instant now) {
        return executeAt(now);
    }

    private RetentionResult executeAt(Instant now) {
        Instant oneDayCutoff = now.minus(1, ChronoUnit.DAYS);
        Instant sevenDayCutoff = now.minus(7, ChronoUnit.DAYS);
        Instant oneYearCutoff = now.atZone(ZoneOffset.UTC).minusYears(1).toInstant();
        LocalDate threeYearCutoff = LocalDate.ofInstant(now, ZoneOffset.UTC).minusYears(3);
        return RetentionResult.builder()
            .registrationIntents(mapper.deleteRegistrationIntentsDue(oneDayCutoff))
            .googleRegistrations(mapper.deleteGoogleRegistrationsDue(oneDayCutoff))
            .emailVerifications(mapper.deleteEmailVerificationsDue(oneDayCutoff))
            .emailVerificationRateLimits(mapper.deleteEmailVerificationRateLimitsDue(now))
            .refreshTokens(mapper.deleteRefreshTokensDue(sevenDayCutoff))
            .releasedLoginLocks(mapper.clearReleasedLoginLocksDue(sevenDayCutoff))
            .lifecycleEvents(mapper.deleteLifecycleEventsDue(oneYearCutoff))
            .exitSurveys(mapper.deleteExitSurveysDue(oneYearCutoff))
            .exitSurveyAggregates(mapper.deleteExitSurveyAggregatesDue(threeYearCutoff))
            .build();
    }

    @Builder
    public record RetentionResult(
        int registrationIntents,
        int googleRegistrations,
        int emailVerifications,
        int emailVerificationRateLimits,
        int refreshTokens,
        int releasedLoginLocks,
        int lifecycleEvents,
        int exitSurveys,
        int exitSurveyAggregates
    ) {
    }
}
