package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.service.EmailVerificationRateLimitException;
import com.margins.auth.service.EmailVerificationRateLimitService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class EmailVerificationRateLimitIntegrationTest extends AbstractMySqlIntegrationTest {
    private static final String SECRET = "integration-rate-limit-secret";

    @Autowired EmailVerificationRateLimitService service;
    @Autowired EmailVerificationAbuseProperties properties;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void enableProtection() {
        jdbc.update("DELETE FROM auth_email_verification_rate_limits");
        properties.setRateLimitSecret(SECRET);
        properties.setEnabled(true);
    }

    @AfterEach
    void disableProtection() {
        properties.setEnabled(false);
        properties.setRateLimitSecret("");
        jdbc.update("DELETE FROM auth_email_verification_rate_limits");
    }

    @Test
    void concurrentReservationsAllowOnlyOneRequestPerEmailMinute() throws Exception {
        int attempts = 8;
        AtomicInteger accepted = new AtomicInteger();
        AtomicInteger limited = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(attempts)) {
            var futures = java.util.stream.IntStream.range(0, attempts)
                .mapToObj(index -> executor.submit(() -> {
                    start.await();
                    try {
                        service.reserve("reader@example.com", "203.0.113." + index);
                        accepted.incrementAndGet();
                    } catch (EmailVerificationRateLimitException exception) {
                        limited.incrementAndGet();
                    }
                    return null;
                }))
                .toList();
            start.countDown();
            for (var future : futures) future.get();
        }

        assertThat(accepted).hasValue(1);
        assertThat(limited).hasValue(attempts - 1);
        assertThat(jdbc.queryForObject("""
            SELECT minute_count FROM auth_email_verification_rate_limits
            WHERE scope_type='EMAIL' AND scope_hash=?
            """, Integer.class, hmac("reader@example.com"))).isEqualTo(1);
    }

    @Test
    void storesOnlyHmacIdentifiersAndReturnsRetryAfter() {
        service.reserve("private@example.com", "203.0.113.8");

        org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.reserve("private@example.com", "203.0.113.8"))
            .isInstanceOfSatisfying(EmailVerificationRateLimitException.class,
                error -> assertThat(error.getRetryAfterSeconds()).isBetween(1L, 61L));
        String hashes = String.join(",", jdbc.queryForList(
            "SELECT scope_hash FROM auth_email_verification_rate_limits", String.class));
        assertThat(hashes)
            .doesNotContain("private@example.com")
            .doesNotContain("203.0.113.8")
            .contains(hmac("private@example.com"))
            .contains(hmac("203.0.113.8"));
    }

    @Test
    void enforcesEmailAndIpHourAndDayLimits() {
        String ip = "203.0.113.20";
        service.reserve("hour@example.com", ip);
        jdbc.update("""
            UPDATE auth_email_verification_rate_limits
            SET minute_window_started_at=CURRENT_TIMESTAMP - INTERVAL 61 SECOND,
                hour_count=5
            WHERE scope_type='EMAIL' AND scope_hash=?
            """, hmac("hour@example.com"));
        org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.reserve("hour@example.com", ip))
            .isInstanceOf(EmailVerificationRateLimitException.class);

        service.reserve("day@example.com", "203.0.113.21");
        jdbc.update("""
            UPDATE auth_email_verification_rate_limits
            SET minute_window_started_at=CURRENT_TIMESTAMP - INTERVAL 61 SECOND,
                hour_window_started_at=CURRENT_TIMESTAMP - INTERVAL 2 HOUR,
                day_count=10
            WHERE scope_type='EMAIL' AND scope_hash=?
            """, hmac("day@example.com"));
        org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.reserve("day@example.com", "203.0.113.21"))
            .isInstanceOf(EmailVerificationRateLimitException.class);

        jdbc.update("""
            UPDATE auth_email_verification_rate_limits
            SET hour_count=20
            WHERE scope_type='IP' AND scope_hash=?
            """, hmac(ip));
        org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.reserve("ip-hour@example.com", ip))
            .isInstanceOf(EmailVerificationRateLimitException.class);

        jdbc.update("""
            UPDATE auth_email_verification_rate_limits
            SET hour_window_started_at=CURRENT_TIMESTAMP - INTERVAL 2 HOUR,
                day_count=50
            WHERE scope_type='IP' AND scope_hash=?
            """, hmac(ip));
        org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.reserve("ip-day@example.com", ip))
            .isInstanceOf(EmailVerificationRateLimitException.class);
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
