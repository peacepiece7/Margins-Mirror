package com.margins.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.auth.service.GoogleOAuthService.GoogleUserProfile;
import com.margins.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class NativeGoogleOAuthStateServiceTest {
    private static final String VERIFIER = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

    @Test
    void boundsPendingStateBeforeRecordingAnotherCaller() {
        NativeGoogleOAuthStateService bounded = new NativeGoogleOAuthStateService(
            Clock.systemUTC(), 1, 1, 1);
        bounded.begin("margins://oauth/google", challenge(VERIFIER), "caller-a");

        assertThatThrownBy(() -> bounded.begin(
            "margins://oauth/google", challenge(VERIFIER), "caller-a"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("COMMON_SERVICE_UNAVAILABLE");
        assertThatThrownBy(() -> bounded.begin(
            "margins://oauth/google", challenge(VERIFIER), "caller-b"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("COMMON_SERVICE_UNAVAILABLE");
    }

    @Test
    void rateLimitsOneCallerWhileStateCapacityRemains() {
        NativeGoogleOAuthStateService bounded = new NativeGoogleOAuthStateService(
            Clock.systemUTC(), 2, 1, 1);
        bounded.begin("margins://oauth/google", challenge(VERIFIER), "caller-a");

        assertThatThrownBy(() -> bounded.begin(
            "margins://oauth/google", challenge(VERIFIER), "caller-a"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("COMMON_RATE_LIMITED");
    }

    @Test
    void fullStateCapacityDoesNotAllocateAWindowForANewCaller() {
        NativeGoogleOAuthStateService bounded = service(1, 2);
        var first = bounded.begin("margins://oauth/google", challenge(VERIFIER), "caller-a");

        assertThatThrownBy(() -> bounded.begin(
            "margins://oauth/google", challenge(VERIFIER), "caller-b"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("COMMON_SERVICE_UNAVAILABLE");

        bounded.consumeState(first.state());
        bounded.begin("margins://oauth/google", challenge(VERIFIER), "caller-b");
    }

    @Test
    void boundsActiveWindowsAcrossUniqueCallers() {
        NativeGoogleOAuthStateService bounded = service(3, 2);
        bounded.begin("margins://oauth/google", challenge(VERIFIER), "caller-a");
        bounded.begin("margins://oauth/google", challenge(VERIFIER), "caller-b");

        assertThatThrownBy(() -> bounded.begin(
            "margins://oauth/google", challenge(VERIFIER), "caller-c"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("COMMON_SERVICE_UNAVAILABLE");
    }

    @Test
    void callerIdentifiersUseAKeyedHmac() throws Exception {
        NativeGoogleOAuthStateService first = serviceWithSecret("first-rate-limit-secret");
        NativeGoogleOAuthStateService second = serviceWithSecret("second-rate-limit-secret");
        String caller = "203.0.113.7";
        String plainSha256 = Base64.getUrlEncoder().withoutPadding().encodeToString(
            MessageDigest.getInstance("SHA-256").digest(caller.getBytes(StandardCharsets.UTF_8)));

        assertThat(first.callerIdentifier(caller)).isNotEqualTo(plainSha256);
        assertThat(first.callerIdentifier(caller)).isNotEqualTo(second.callerIdentifier(caller));
        assertThat(first.callerIdentifier(caller)).isEqualTo(first.callerIdentifier(caller));
    }

    @Test
    void rejectsMissingRateLimitSecret() {
        assertThatThrownBy(() -> new NativeGoogleOAuthStateService(
            Clock.systemUTC(), 1, 1, 1, 1, " "))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("rate-limit secret is required");
    }

    @Test
    void expiredEntriesAreEvictedAndOneTimeCodesCannotReplay() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-24T00:00:00Z"));
        NativeGoogleOAuthStateService service = new NativeGoogleOAuthStateService(clock, 1, 1, 20);
        var first = service.begin("margins://oauth/google", challenge(VERIFIER), "caller-a");
        clock.now = clock.now.plusSeconds(601);
        service.begin("margins://oauth/google", challenge(VERIFIER), "caller-b");
        assertThatThrownBy(() -> service.consumeState(first.state()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("AUTH_GOOGLE_OAUTH_STATE_INVALID");

        String code = service.issueProfile(
            new GoogleUserProfile("subject", "reader@example.com", true, "Reader"),
            challenge(VERIFIER));
        service.consumeExchange(code, VERIFIER);
        assertThatThrownBy(() -> service.consumeExchange(code, VERIFIER))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("AUTH_GOOGLE_OAUTH_REQUEST_INVALID");
    }

    @Test
    void concurrentConsumersIssueExactlyOneGrant() throws Exception {
        NativeGoogleOAuthStateService service = new NativeGoogleOAuthStateService();
        String code = service.issueProfile(
            new GoogleUserProfile("subject", "reader@example.com", true, "Reader"),
            challenge(VERIFIER));
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger();
        AtomicInteger replays = new AtomicInteger();
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> {
                consume(service, code, start, successes, replays);
                return null;
            });
            var second = executor.submit(() -> {
                consume(service, code, start, successes, replays);
                return null;
            });
            start.countDown();
            first.get();
            second.get();
        } finally {
            executor.shutdownNow();
        }

        assertThat(successes.get()).isEqualTo(1);
        assertThat(replays.get()).isEqualTo(1);
    }

    private NativeGoogleOAuthStateService service(int maxStates, int maxStartWindows) {
        return new NativeGoogleOAuthStateService(
            Clock.systemUTC(), maxStates, 1, 20, maxStartWindows, "test-rate-limit-secret");
    }

    private NativeGoogleOAuthStateService serviceWithSecret(String secret) {
        return new NativeGoogleOAuthStateService(Clock.systemUTC(), 1, 1, 1, 1, secret);
    }

    private void consume(
        NativeGoogleOAuthStateService service,
        String code,
        CountDownLatch start,
        AtomicInteger successes,
        AtomicInteger replays
    ) throws InterruptedException {
        start.await();
        try {
            service.consumeExchange(code, VERIFIER);
            successes.incrementAndGet();
        } catch (ApiException exception) {
            replays.incrementAndGet();
        }
    }

    private static String challenge(String verifier) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(
                    verifier.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
