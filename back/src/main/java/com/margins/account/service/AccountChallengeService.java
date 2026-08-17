package com.margins.account.service;

import com.margins.account.mapper.AccountMapper;
import com.margins.account.model.AccountChallengeRecord;
import com.margins.auth.model.UserRecord;
import com.margins.auth.service.MailService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccountChallengeService {
    public static final String RESIGNATION = "ACCOUNT_RESIGNATION";
    public static final String RECOVERY = "ACCOUNT_RECOVERY";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountMapper accountMapper;
    private final MailService mailService;
    private final Environment environment;

    @Value("${margins.auth.challenge-secret}")
    private String secret;

    @jakarta.annotation.PostConstruct
    void validateSecret() {
        if (environment.acceptsProfiles(Profiles.of("prod"))
            && (secret == null || secret.isBlank() || secret.startsWith("margins-local-"))) {
            throw new IllegalStateException("MARGINS_AUTH_CHALLENGE_SECRET is required in production");
        }
    }

    public ChallengeIssued issueForUser(UserRecord user, String purpose, String remoteAddress) {
        Instant now = Instant.now();
        String ipHash = hash(remoteAddress == null ? "unknown" : remoteAddress);
        Instant last = accountMapper.lastChallengeAt(user.getId(), purpose);
        if (last != null && last.isAfter(now.minusSeconds(60))) {
            throw new ApiException(ApiErrorCode.ACCOUNT_CHALLENGE_RATE_LIMITED);
        }
        if (accountMapper.countUserChallenges(user.getId(), now.minus(1, ChronoUnit.HOURS)) >= 5
            || accountMapper.countUserChallenges(user.getId(), now.minus(1, ChronoUnit.DAYS)) >= 10
            || accountMapper.countIpChallenges(ipHash, now.minus(1, ChronoUnit.HOURS)) >= 20) {
            throw new ApiException(ApiErrorCode.ACCOUNT_CHALLENGE_RATE_LIMITED);
        }
        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        AccountChallengeRecord challenge = AccountChallengeRecord.builder()
            .id(UUID.randomUUID().toString())
            .userId(user.getId())
            .purpose(purpose)
            .email(user.getEmail())
            .codeHmac(hmac(code))
            .expiresAt(now.plusSeconds(300))
            .requestIpHash(ipHash)
            .build();
        accountMapper.insertChallenge(challenge);
        mailService.sendVerificationCode(user.getEmail(), code, 300);
        return new ChallengeIssued(challenge.getId(), 300, exposeCode() ? code : null);
    }

    public VerificationResult verify(String id, String purpose, String code) {
        Instant now = Instant.now();
        AccountChallengeRecord challenge = accountMapper.findChallenge(id)
            .filter(value -> purpose.equals(value.getPurpose()))
            .orElseThrow(() -> invalidChallenge());
        if (challenge.getUsedAt() != null || challenge.getVerifiedAt() != null
            || !challenge.getExpiresAt().isAfter(now) || challenge.getFailedAttempts() >= 5) {
            throw invalidChallenge();
        }
        if (!MessageDigest.isEqual(hmac(code).getBytes(StandardCharsets.UTF_8),
            challenge.getCodeHmac().getBytes(StandardCharsets.UTF_8))) {
            accountMapper.incrementChallengeFailure(id);
            throw invalidChallenge();
        }
        String token = randomToken();
        accountMapper.verifyChallenge(id, now, hash(token), now.plusSeconds(300));
        return new VerificationResult(token, 300);
    }

    public void consume(String rawToken, String purpose, Long userId) {
        if (rawToken == null || accountMapper.consumeActionToken(hash(rawToken), purpose, userId, Instant.now()) != 1) {
            throw new ApiException(ApiErrorCode.ACCOUNT_CHALLENGE_INVALID);
        }
    }

    public String neutralChallengeId() {
        return UUID.randomUUID().toString();
    }

    private ApiException invalidChallenge() {
        return new ApiException(ApiErrorCode.ACCOUNT_CHALLENGE_INVALID);
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return hex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("challenge HMAC failure", exception);
        }
    }

    private String hash(String value) {
        try {
            return hex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("challenge hash failure", exception);
        }
    }

    private String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02x", value));
        return result.toString();
    }

    private boolean exposeCode() {
        return environment.acceptsProfiles(Profiles.of("local", "test"));
    }

    public record ChallengeIssued(String challengeId, int expiresInSeconds, String devVerificationCode) {}
    public record VerificationResult(String actionToken, int expiresInSeconds) {}
}
