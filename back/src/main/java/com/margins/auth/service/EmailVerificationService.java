package com.margins.auth.service;

import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.dto.EmailVerificationConfirmResponse;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.auth.mapper.AuthEmailVerificationMapper;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.model.AuthEmailVerificationRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

/**
 * 이메일 인증 코드 발급과 확인을 처리하는 서비스다.
 * 검증 코드 저장, 만료 확인, 발송 요청을 한 흐름으로 묶는다.
 */
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthEmailVerificationMapper authEmailVerificationMapper;
    private final UserMapper userMapper;
    private final MailService mailService;
    private final MailVerificationProperties properties;
    private final Environment environment;
    private final BotChallengeVerifier botChallengeVerifier;
    private final EmailVerificationRateLimitService rateLimitService;
    private final EmailVerificationAbuseProperties abuseProperties;

    public EmailVerificationResponse issueCode(String email, String botChallengeToken, String clientIp) {
        String normalizedEmail = normalizeEmail(email);
        if (userMapper.findByEmail(normalizedEmail).isPresent()) {
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_ALREADY_REGISTERED);
        }
        rateLimitService.precheck(normalizedEmail, clientIp);
        botChallengeVerifier.verify(botChallengeToken, clientIp);
        rateLimitService.reserve(normalizedEmail, clientIp);
        String code = "%06d".formatted(RANDOM.nextInt(1_000_000));
        int ttlSeconds = Math.max(60, properties.getTtlSeconds());

        authEmailVerificationMapper.expireActiveForEmail(normalizedEmail);
        authEmailVerificationMapper.insert(AuthEmailVerificationRecord.builder()
            .email(normalizedEmail)
            .codeHash(hashCode(normalizedEmail, code))
            .expiresAt(Instant.now().plus(ttlSeconds, ChronoUnit.SECONDS))
            .testData(isTestRuntime())
            .build());

        try {
            mailService.sendVerificationCode(normalizedEmail, code, ttlSeconds);
        } catch (MailDeliveryException exception) {
            authEmailVerificationMapper.expireActiveForEmail(normalizedEmail);
            throw exception;
        }

        return EmailVerificationResponse.builder()
            .email(normalizedEmail)
            .expiresInSeconds(ttlSeconds)
            .resendAfterSeconds(Math.max(60, abuseProperties.getResendAfterSeconds()))
            .devVerificationCode(shouldExposeCode() ? code : null)
            .build();
    }

    public EmailVerificationConfirmResponse verifyCode(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);
        int updated = authEmailVerificationMapper.consumeActiveCode(
            normalizedEmail,
            hashCode(normalizedEmail, normalizedCode)
        );
        if (updated <= 0 && !hasVerifiedCode(normalizedEmail, normalizedCode)) {
            authEmailVerificationMapper.recordFailedAttempt(normalizedEmail);
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_VERIFICATION_INVALID);
        }

        return EmailVerificationConfirmResponse.builder()
            .email(normalizedEmail)
            .verified(true)
            .build();
    }

    public void requireVerifiedCode(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);
        if (hasVerifiedCode(normalizedEmail, normalizedCode)) {
            return;
        }
        int updated = authEmailVerificationMapper.consumeActiveCode(
            normalizedEmail,
            hashCode(normalizedEmail, normalizedCode)
        );
        if (updated <= 0) {
            authEmailVerificationMapper.recordFailedAttempt(normalizedEmail);
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_VERIFICATION_INVALID);
        }
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_REQUIRED);
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeCode(String code) {
        if (code == null || !code.trim().matches("\\d{6}")) {
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_VERIFICATION_INVALID);
        }
        return code.trim();
    }

    private boolean hasVerifiedCode(String email, String code) {
        return authEmailVerificationMapper.countVerifiedCode(email, hashCode(email, code)) > 0;
    }

    private String hashCode(String email, String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            // hash = toHash(<email>:<code>)
            // hash == db.getEmailVerification("email") 비교하는 느낌
            byte[] hash = digest.digest((email + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("email verification code could not be hashed", exception);
        }
    }

    private boolean shouldExposeCode() {
        return properties.isExposeCode();
    }

    private boolean isTestRuntime() {
        return environment.acceptsProfiles(Profiles.of("local", "test"));
    }
}
