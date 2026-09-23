package com.margins.auth.service;

import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.config.NativeTurnstileBridgeProperties;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.auth.dto.NativeTurnstileBridgeCreateResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class NativeTurnstileBridgeService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int PROOF_BYTES = 32;

    private final NativeTurnstileBridgeProperties properties;
    private final BotChallengeVerifier botChallengeVerifier;
    private final EmailVerificationService emailVerificationService;
    private final EmailVerificationRateLimitService rateLimitService;
    private final EmailVerificationAbuseProperties abuseProperties;
    private final Clock clock;
    private final Map<String, BridgeState> bridges = new ConcurrentHashMap<>();
    private final Map<String, CreationWindow> creationWindows = new ConcurrentHashMap<>();
    private final Object creationLock = new Object();

    @Autowired
    public NativeTurnstileBridgeService(
        NativeTurnstileBridgeProperties properties,
        BotChallengeVerifier botChallengeVerifier,
        EmailVerificationService emailVerificationService,
        EmailVerificationRateLimitService rateLimitService,
        EmailVerificationAbuseProperties abuseProperties
    ) {
        this(
            properties,
            botChallengeVerifier,
            emailVerificationService,
            rateLimitService,
            abuseProperties,
            Clock.systemUTC()
        );
    }

    NativeTurnstileBridgeService(
        NativeTurnstileBridgeProperties properties,
        BotChallengeVerifier botChallengeVerifier,
        EmailVerificationService emailVerificationService,
        EmailVerificationRateLimitService rateLimitService,
        EmailVerificationAbuseProperties abuseProperties,
        Clock clock
    ) {
        this.properties = properties;
        this.botChallengeVerifier = botChallengeVerifier;
        this.emailVerificationService = emailVerificationService;
        this.rateLimitService = rateLimitService;
        this.abuseProperties = abuseProperties;
        this.clock = clock;
    }

    public NativeTurnstileBridgeCreateResponse create(String email) {
        return create(email, "unknown");
    }

    public NativeTurnstileBridgeCreateResponse create(String email, String clientIp) {
        requireConfigured();
        String normalizedEmail = normalizeEmail(email);
        String normalizedClientIp = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp;
        rateLimitService.precheck(normalizedEmail, normalizedClientIp);
        synchronized (creationLock) {
            removeExpired();
            if (bridges.size() >= properties.getCapacity()) {
                throw unavailable();
            }
            reserveCreation(normalizedClientIp);
            String bridgeId = UUID.randomUUID().toString();
            String nativeProof = randomProof();
            Instant expiresAt = clock.instant().plusSeconds(properties.getTtlSeconds());
            bridges.put(bridgeId, new BridgeState(
                normalizedEmail,
                hashProof(bridgeId, nativeProof),
                expiresAt
            ));
            return NativeTurnstileBridgeCreateResponse.builder()
                .bridgeId(bridgeId)
                .nativeProof(nativeProof)
                .hostedUrl(hostedBaseUrl() + "/api/auth/mobile/email-verification-bridge/" + bridgeId)
                .expiresInSeconds(properties.getTtlSeconds())
                .build();
        }
    }

    public void requireActive(String bridgeId) {
        requireConfigured();
        BridgeState state = bridges.get(bridgeId);
        if (state == null || expired(state)) {
            if (state != null) bridges.remove(bridgeId, state);
            throw invalid();
        }
        synchronized (state) {
            if (state.consumed || expired(state)) throw invalid();
        }
    }

    public void complete(String bridgeId, String token, String clientIp) {
        requireConfigured();
        BridgeState state = activeState(bridgeId);
        synchronized (state) {
            if (state.consumed || expired(state)) throw invalid();
            if (state.completed) return;
            botChallengeVerifier.verify(token, clientIp);
            state.completed = true;
        }
    }

    public EmailVerificationResponse redeem(
        String email,
        String bridgeId,
        String nativeProof,
        String clientIp
    ) {
        requireConfigured();
        String normalizedEmail = normalizeEmail(email);
        BridgeState state = activeState(bridgeId);
        synchronized (state) {
            if (state.consumed
                || expired(state)
                || !state.completed
                || !state.email.equals(normalizedEmail)
                || !MessageDigest.isEqual(
                    state.proofHash.getBytes(StandardCharsets.US_ASCII),
                    hashProof(bridgeId, nativeProof).getBytes(StandardCharsets.US_ASCII)
                )) {
                throw invalid();
            }
            state.consumed = true;
        }
        bridges.remove(bridgeId, state);
        return emailVerificationService.issueCodeAfterVerifiedBotChallenge(normalizedEmail, clientIp);
    }

    public String siteKey() {
        requireConfigured();
        return properties.getSiteKey().trim();
    }

    public String returnUri() {
        requireConfigured();
        return properties.getReturnUri().trim();
    }

    private BridgeState activeState(String bridgeId) {
        if (bridgeId == null || bridgeId.isBlank()) throw invalid();
        BridgeState state = bridges.get(bridgeId);
        if (state == null || expired(state)) {
            if (state != null) bridges.remove(bridgeId, state);
            throw invalid();
        }
        return state;
    }

    private void removeExpired() {
        bridges.entrySet().removeIf(entry -> expired(entry.getValue()));
        Instant now = clock.instant();
        creationWindows.entrySet().removeIf(
            entry -> !now.isBefore(entry.getValue().expiresAt));
    }

    private void reserveCreation(String clientIp) {
        Instant now = clock.instant();
        String callerKey = rateLimitService.hmac(clientIp);
        CreationWindow window = creationWindows.get(callerKey);
        if (window == null || !now.isBefore(window.expiresAt)) {
            if (window != null) creationWindows.remove(callerKey, window);
            if (creationWindows.size() >= properties.getCallerCapacity()) {
                throw unavailable();
            }
            creationWindows.put(callerKey, new CreationWindow(
                1, now.plusSeconds(60)));
            return;
        }
        if (window.count >= properties.getCreateLimitPerMinute()) {
            long retryAfter = Math.max(1, window.expiresAt.getEpochSecond() - now.getEpochSecond());
            throw new EmailVerificationRateLimitException(retryAfter);
        }
        window.count++;
    }

    int activeCreationCallerCount() {
        synchronized (creationLock) {
            removeExpired();
            return creationWindows.size();
        }
    }

    private boolean expired(BridgeState state) {
        return !clock.instant().isBefore(state.expiresAt);
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_REQUIRED);
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String randomProof() {
        byte[] value = new byte[PROOF_BYTES];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private String hashProof(String bridgeId, String proof) {
        if (proof == null) throw invalid();
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(
                (bridgeId + ":" + proof).getBytes(StandardCharsets.UTF_8)
            ));
        } catch (Exception exception) {
            throw new IllegalStateException("native Turnstile proof could not be hashed", exception);
        }
    }

    private String hostedBaseUrl() {
        String value = properties.getHostedBaseUrl().trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private void requireConfigured() {
        if (!properties.isConfigured() || !abuseProperties.isEnabled()) throw unavailable();
    }

    private ApiException invalid() {
        return new ApiException(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
    }

    private ApiException unavailable() {
        return new ApiException(ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
    }

    private static final class BridgeState {
        private final String email;
        private final String proofHash;
        private final Instant expiresAt;
        private boolean completed;
        private boolean consumed;

        private BridgeState(String email, String proofHash, Instant expiresAt) {
            this.email = email;
            this.proofHash = proofHash;
            this.expiresAt = expiresAt;
        }
    }

    private static final class CreationWindow {
        private int count;
        private final Instant expiresAt;

        private CreationWindow(int count, Instant expiresAt) {
            this.count = count;
            this.expiresAt = expiresAt;
        }
    }
}
