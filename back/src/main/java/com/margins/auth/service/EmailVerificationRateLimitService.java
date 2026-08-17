package com.margins.auth.service;

import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.mapper.EmailVerificationRateLimitMapper;
import com.margins.auth.model.EmailVerificationRateLimitRecord;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmailVerificationRateLimitService {
    private static final String EMAIL = "EMAIL";
    private static final String IP = "IP";
    private static final Duration MINUTE = Duration.ofSeconds(60);
    private static final Duration HOUR = Duration.ofHours(1);
    private static final Duration DAY = Duration.ofHours(24);

    private final EmailVerificationRateLimitMapper mapper;
    private final EmailVerificationAbuseProperties properties;
    private final Environment environment;

    public void precheck(String email, String clientIp) {
        if (!properties.isEnabled()) return;
        Instant now = Instant.now();
        check(mapper.find(EMAIL, hmac(email)).orElse(null), now);
        check(mapper.find(IP, hmac(clientIp)).orElse(null), now);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reserve(String email, String clientIp) {
        if (!properties.isEnabled()) return;
        Instant now = Instant.now();
        Instant retentionAfter = now.plus(3, ChronoUnit.DAYS);
        boolean testData = environment.acceptsProfiles(Profiles.of("local", "test"));
        String emailHash = hmac(email);
        String ipHash = hmac(clientIp);

        mapper.insertIfMissing(EMAIL, emailHash, retentionAfter, testData);
        mapper.insertIfMissing(IP, ipHash, retentionAfter, testData);
        EmailVerificationRateLimitRecord emailRecord = normalized(
            mapper.findForUpdate(EMAIL, emailHash), now);
        EmailVerificationRateLimitRecord ipRecord = normalized(
            mapper.findForUpdate(IP, ipHash), now);
        check(emailRecord, now);
        check(ipRecord, now);
        mapper.update(increment(emailRecord));
        mapper.update(increment(ipRecord));
    }

    String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                properties.getRateLimitSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("email verification rate-limit identifier could not be hashed", exception);
        }
    }

    private void check(EmailVerificationRateLimitRecord record, Instant now) {
        if (record == null) return;
        EmailVerificationRateLimitRecord current = normalized(record, now);
        long retry = 0;
        if (EMAIL.equals(current.getScopeType()) && current.getMinuteCount() >= 1) {
            retry = Math.max(retry, retryAfter(current.getMinuteWindowStartedAt(), MINUTE, now));
        }
        int hourLimit = EMAIL.equals(current.getScopeType()) ? 5 : 20;
        int dayLimit = EMAIL.equals(current.getScopeType()) ? 10 : 50;
        if (current.getHourCount() >= hourLimit) {
            retry = Math.max(retry, retryAfter(current.getHourWindowStartedAt(), HOUR, now));
        }
        if (current.getDayCount() >= dayLimit) {
            retry = Math.max(retry, retryAfter(current.getDayWindowStartedAt(), DAY, now));
        }
        if (retry > 0) throw new EmailVerificationRateLimitException(retry);
    }

    private EmailVerificationRateLimitRecord normalized(
        EmailVerificationRateLimitRecord record,
        Instant now
    ) {
        Instant minuteStart = activeStart(record.getMinuteWindowStartedAt(), MINUTE, now);
        Instant hourStart = activeStart(record.getHourWindowStartedAt(), HOUR, now);
        Instant dayStart = activeStart(record.getDayWindowStartedAt(), DAY, now);
        return record.toBuilder()
            .minuteWindowStartedAt(minuteStart)
            .minuteCount(minuteStart.equals(now) ? 0 : record.getMinuteCount())
            .hourWindowStartedAt(hourStart)
            .hourCount(hourStart.equals(now) ? 0 : record.getHourCount())
            .dayWindowStartedAt(dayStart)
            .dayCount(dayStart.equals(now) ? 0 : record.getDayCount())
            .build();
    }

    private Instant activeStart(Instant start, Duration window, Instant now) {
        return start == null || !now.isBefore(start.plus(window)) ? now : start;
    }

    private EmailVerificationRateLimitRecord increment(EmailVerificationRateLimitRecord record) {
        return record.toBuilder()
            .minuteCount(record.getMinuteCount() + 1)
            .hourCount(record.getHourCount() + 1)
            .dayCount(record.getDayCount() + 1)
            .retentionAfter(record.getDayWindowStartedAt().plus(3, ChronoUnit.DAYS))
            .build();
    }

    private long retryAfter(Instant start, Duration window, Instant now) {
        return Math.max(1, Duration.between(now, start.plus(window)).getSeconds() + 1);
    }
}
