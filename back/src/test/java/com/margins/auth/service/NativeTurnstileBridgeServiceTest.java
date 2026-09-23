package com.margins.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.auth.config.NativeTurnstileBridgeProperties;
import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NativeTurnstileBridgeServiceTest {
    private final BotChallengeVerifier verifier = mock(BotChallengeVerifier.class);
    private final EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);
    private final EmailVerificationRateLimitService rateLimitService = mock(EmailVerificationRateLimitService.class);
    private final EmailVerificationAbuseProperties abuseProperties = new EmailVerificationAbuseProperties();
    private final MutableClock clock = new MutableClock(Instant.parse("2026-08-24T00:00:00Z"));
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private NativeTurnstileBridgeProperties properties;
    private NativeTurnstileBridgeService service;

    @BeforeEach
    void setUp() {
        abuseProperties.setEnabled(true);
        properties = configuredProperties();
        service = new NativeTurnstileBridgeService(
            properties,
            verifier,
            emailVerificationService,
            rateLimitService,
            abuseProperties,
            clock
        );
        when(rateLimitService.hmac(anyString())).thenAnswer(
            invocation -> "hmac:" + invocation.getArgument(0, String.class));
        when(emailVerificationService.issueCodeAfterVerifiedBotChallenge(anyString(), anyString()))
            .thenReturn(EmailVerificationResponse.builder().email("reader@example.com").build());
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void createKeepsEmailAndProofOutOfHostedUrl() {
        var bridge = service.create("Reader@Example.com");

        assertThat(bridge.getHostedUrl())
            .isEqualTo("https://margins.example/api/auth/mobile/email-verification-bridge/"
                + bridge.getBridgeId())
            .doesNotContain("reader", bridge.getNativeProof());
        assertThat(bridge.getExpiresInSeconds()).isEqualTo(300);
    }

    @Test
    void concurrentCompletionVerifiesTurnstileOnlyOnce() throws Exception {
        var bridge = service.create("reader@example.com");
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        org.mockito.Mockito.doAnswer(invocation -> {
            entered.countDown();
            assertThat(release.await(2, TimeUnit.SECONDS)).isTrue();
            return null;
        }).when(verifier).verify("turnstile-token", "203.0.113.4");

        Future<?> first = executor.submit(() -> service.complete(
            bridge.getBridgeId(), "turnstile-token", "203.0.113.4"));
        assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
        Future<?> second = executor.submit(() -> service.complete(
            bridge.getBridgeId(), "turnstile-token", "203.0.113.4"));
        release.countDown();
        first.get(2, TimeUnit.SECONDS);
        second.get(2, TimeUnit.SECONDS);

        verify(verifier, times(1)).verify("turnstile-token", "203.0.113.4");
    }

    @Test
    void concurrentRedeemConsumesProofOnce() throws Exception {
        var bridge = service.create("reader@example.com");
        service.complete(bridge.getBridgeId(), "turnstile-token", "203.0.113.4");

        List<Future<Boolean>> results = List.of(
            executor.submit(() -> redeemSucceeded(bridge.getBridgeId(), bridge.getNativeProof())),
            executor.submit(() -> redeemSucceeded(bridge.getBridgeId(), bridge.getNativeProof()))
        );

        assertThat(results.get(0).get(2, TimeUnit.SECONDS) ^ results.get(1).get(2, TimeUnit.SECONDS))
            .isTrue();
        verify(emailVerificationService, times(1))
            .issueCodeAfterVerifiedBotChallenge("reader@example.com", "203.0.113.4");
    }

    @Test
    void expiredAndCapacityBoundedBridgesFailClosed() {
        properties.setCapacity(1);
        var bridge = service.create("reader@example.com");

        assertApiError(() -> service.create("other@example.com"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
        assertThat(service.activeCreationCallerCount()).isEqualTo(1);
        clock.advance(Duration.ofSeconds(300));
        assertApiError(() -> service.complete(
            bridge.getBridgeId(), "turnstile-token", "203.0.113.4"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
        assertThat(service.create("other@example.com").getBridgeId()).isNotBlank();
    }

    @Test
    void bridgeCannotRunWhenTurnstileAbuseProtectionIsDisabled() {
        abuseProperties.setEnabled(false);

        assertApiError(() -> service.create("reader@example.com"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
    }

    @Test
    void bridgeCreationIsRateLimitedByAKeyedCallerIdentifier() {
        properties.setCreateLimitPerMinute(2);
        service.create("one@example.com", "203.0.113.4");
        service.create("two@example.com", "203.0.113.4");

        assertThatThrownBy(() -> service.create("three@example.com", "203.0.113.4"))
            .isInstanceOf(EmailVerificationRateLimitException.class);
        assertThat(service.activeCreationCallerCount()).isEqualTo(1);

        clock.advance(Duration.ofSeconds(61));
        assertThat(service.create("three@example.com", "203.0.113.4").getBridgeId())
            .isNotBlank();
    }

    @Test
    void wrongEmailOrProofCannotRedeemCompletedBridge() {
        var bridge = service.create("reader@example.com");
        service.complete(bridge.getBridgeId(), "turnstile-token", "203.0.113.4");

        assertApiError(() -> service.redeem(
            "other@example.com", bridge.getBridgeId(), bridge.getNativeProof(), "203.0.113.4"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
        assertApiError(() -> service.redeem(
            "reader@example.com", bridge.getBridgeId(), "wrong-proof", "203.0.113.4"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
    }

    @Test
    void unsafeReturnUriRejectsCreation() {
        properties.setReturnUri("cloud.margins.mobile://auth?email=reader@example.com");

        assertApiError(() -> service.create("reader@example.com"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
    }

    @Test
    void customSchemeReturnUriRejectsCreation() {
        properties.setReturnUri("margins://email-verification");

        assertApiError(() -> service.create("reader@example.com"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
    }

    @Test
    void opaqueHttpsReturnUriRejectsCreation() {
        properties.setReturnUri("https:email-verification");

        assertApiError(() -> service.create("reader@example.com"),
            ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
    }

    private boolean redeemSucceeded(String bridgeId, String proof) {
        try {
            service.redeem("reader@example.com", bridgeId, proof, "203.0.113.4");
            return true;
        } catch (ApiException exception) {
            assertThat(exception.getCode()).isEqualTo(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
            return false;
        }
    }

    private void assertApiError(Runnable action, ApiErrorCode code) {
        assertThatThrownBy(action::run)
            .isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getCode()).isEqualTo(code));
    }

    private NativeTurnstileBridgeProperties configuredProperties() {
        NativeTurnstileBridgeProperties value = new NativeTurnstileBridgeProperties();
        value.setEnabled(true);
        value.setSiteKey("site-key");
        value.setHostedBaseUrl("https://margins.example");
        value.setReturnUri("https://margins.example/oauth/email-verification");
        value.setTtlSeconds(300);
        value.setCapacity(16);
        return value;
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        private void advance(Duration duration) {
            now = now.plus(duration);
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
