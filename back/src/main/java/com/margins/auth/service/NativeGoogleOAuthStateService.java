package com.margins.auth.service;

import com.margins.auth.service.GoogleOAuthService.GoogleUserProfile;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Server-owned, one-time native OAuth state and app exchange grants. Raw codes are never stored. */
@Service
public class NativeGoogleOAuthStateService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final Duration EXCHANGE_TTL = Duration.ofMinutes(2);
    private static final Duration START_WINDOW = Duration.ofMinutes(10);
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String TEST_RATE_LIMIT_SECRET = "native-google-oauth-test-rate-limit-secret";
    private static final String SHA_256_CHALLENGE_PATTERN = "[A-Za-z0-9_-]{43}";

    private final Map<String, PendingState> states = new HashMap<>();
    private final Map<String, PendingExchange> exchanges = new HashMap<>();
    private final Map<String, StartWindow> startWindows = new HashMap<>();
    private final Clock clock;
    private final int maxStates;
    private final int maxExchanges;
    private final int maxStartsPerWindow;
    private final int maxStartWindows;
    private final SecretKeySpec rateLimitKey;

    public NativeGoogleOAuthStateService() {
        this(Clock.systemUTC(), 2048, 2048, 20, 2048, TEST_RATE_LIMIT_SECRET);
    }

    @Autowired
    public NativeGoogleOAuthStateService(
        @Value("${margins.auth.google.rate-limit-secret:${margins.auth.challenge-secret:}}")
        String rateLimitSecret
    ) {
        this(Clock.systemUTC(), 2048, 2048, 20, 2048, rateLimitSecret);
    }

    public NativeGoogleOAuthStateService(
        Clock clock,
        int maxStates,
        int maxExchanges,
        int maxStartsPerWindow
    ) {
        this(clock, maxStates, maxExchanges, maxStartsPerWindow, maxStates, TEST_RATE_LIMIT_SECRET);
    }

    public NativeGoogleOAuthStateService(
        Clock clock,
        int maxStates,
        int maxExchanges,
        int maxStartsPerWindow,
        int maxStartWindows,
        String rateLimitSecret
    ) {
        if (clock == null) throw new IllegalArgumentException("clock is required");
        if (maxStates <= 0 || maxExchanges <= 0 || maxStartsPerWindow <= 0 || maxStartWindows <= 0) {
            throw new IllegalArgumentException("native Google OAuth capacities must be positive");
        }
        if (rateLimitSecret == null || rateLimitSecret.isBlank()) {
            throw new IllegalStateException("native Google OAuth rate-limit secret is required");
        }
        this.clock = clock;
        this.maxStates = maxStates;
        this.maxExchanges = maxExchanges;
        this.maxStartsPerWindow = maxStartsPerWindow;
        this.maxStartWindows = maxStartWindows;
        this.rateLimitKey = new SecretKeySpec(
            rateLimitSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }

    public synchronized NativeAuthorization begin(String redirectUri, String deviceChallenge) {
        return begin(redirectUri, deviceChallenge, null);
    }

    public synchronized NativeAuthorization begin(
        String redirectUri,
        String deviceChallenge,
        String callerKey
    ) {
        requireDeviceChallenge(deviceChallenge);
        Instant now = clock.instant();
        purgeExpired(now);
        if (states.size() >= maxStates) {
            throw new ApiException(ApiErrorCode.COMMON_SERVICE_UNAVAILABLE);
        }
        requireStartCapacity(callerKey, now);
        String state = randomToken(32);
        String nonce = randomToken(32);
        String providerVerifier = randomToken(64);
        String providerChallenge = challenge(providerVerifier);
        states.put(hash(state), new PendingState(
            redirectUri,
            nonce,
            providerVerifier,
            deviceChallenge,
            now.plus(STATE_TTL)));
        return new NativeAuthorization(state, nonce, providerChallenge);
    }

    public synchronized PendingState consumeState(String state) {
        PendingState pending = state == null ? null : states.remove(hash(state));
        if (pending == null || !pending.expiresAt().isAfter(clock.instant())) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_STATE_INVALID);
        }
        return pending;
    }

    public synchronized String issueProfile(GoogleUserProfile profile, String deviceChallenge) {
        Instant now = clock.instant();
        purgeExpired(now);
        if (exchanges.size() >= maxExchanges) {
            throw new ApiException(ApiErrorCode.COMMON_SERVICE_UNAVAILABLE);
        }
        return issueExchange(new PendingExchange(profile, deviceChallenge, now.plus(EXCHANGE_TTL)));
    }

    public synchronized PendingExchange consumeExchange(String code, String verifier) {
        String codeHash = code == null ? null : hash(code);
        PendingExchange pending = codeHash == null ? null : exchanges.get(codeHash);
        if (pending == null || !pending.expiresAt().isAfter(clock.instant())) {
            if (pending != null) exchanges.remove(codeHash, pending);
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
        }
        byte[] expected = pending.deviceChallenge().getBytes(StandardCharsets.US_ASCII);
        byte[] actual = verifier == null
            ? new byte[0]
            : challenge(verifier).getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
        }
        exchanges.remove(codeHash, pending);
        return pending;
    }

    private String issueExchange(PendingExchange pending) {
        String code = randomToken(32);
        exchanges.put(hash(code), pending);
        return code;
    }

    private void requireStartCapacity(String callerKey, Instant now) {
        if (callerKey == null || callerKey.isBlank()) return;
        String key = callerIdentifier(callerKey);
        StartWindow current = startWindows.get(key);
        if (current == null || !current.expiresAt().isAfter(now)) {
            if (startWindows.size() >= maxStartWindows) {
                throw new ApiException(ApiErrorCode.COMMON_SERVICE_UNAVAILABLE);
            }
            startWindows.put(key, new StartWindow(1, now.plus(START_WINDOW)));
            return;
        }
        if (current.count() >= maxStartsPerWindow) {
            throw new ApiException(ApiErrorCode.COMMON_RATE_LIMITED);
        }
        startWindows.put(key, new StartWindow(current.count() + 1, current.expiresAt()));
    }

    String callerIdentifier(String callerKey) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(rateLimitKey);
            return encode(mac.doFinal(callerKey.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(
                "native Google OAuth rate-limit identifier could not be hashed", exception);
        }
    }

    private void purgeExpired(Instant now) {
        states.values().removeIf(value -> !value.expiresAt().isAfter(now));
        exchanges.values().removeIf(value -> !value.expiresAt().isAfter(now));
        startWindows.values().removeIf(value -> !value.expiresAt().isAfter(now));
    }

    private String hash(String value) {
        return encode(digest(value));
    }

    private String challenge(String verifier) {
        return encode(digest(verifier));
    }

    private void requireDeviceChallenge(String challenge) {
        if (challenge == null || !challenge.matches(SHA_256_CHALLENGE_PATTERN)) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
        }
    }

    private byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private String randomToken(int size) {
        byte[] bytes = new byte[size];
        RANDOM.nextBytes(bytes);
        return encode(bytes);
    }

    private String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record NativeAuthorization(String state, String nonce, String codeChallenge) {}
    public record PendingState(
        String redirectUri,
        String nonce,
        String codeVerifier,
        String deviceChallenge,
        Instant expiresAt
    ) {}
    public record PendingExchange(
        GoogleUserProfile profile,
        String deviceChallenge,
        Instant expiresAt
    ) {}
    private record StartWindow(int count, Instant expiresAt) {}
}
