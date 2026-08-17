package com.margins.auth.business;

import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.AuthProperties;
import com.margins.auth.dto.EmailAvailabilityResponse;
import com.margins.auth.dto.LoginRequest;
import com.margins.auth.dto.LoginResponse;
import com.margins.auth.dto.MeResponse;
import com.margins.auth.dto.RegisterRequest;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.mapper.UserOAuthIdentityMapper;
import com.margins.auth.model.UserOAuthIdentityRecord;
import com.margins.auth.model.UserRecord;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.service.RefreshTokenService;
import com.margins.auth.service.RefreshTokenService.IssuedRefreshToken;
import com.margins.auth.service.RefreshTokenService.RotationResult;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.auth.service.EmailVerificationService;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.membership.service.MembershipService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 도메인의 핵심 규칙을 처리한다.
 * 로그인, 회원가입, 토큰 재발급, 로그아웃 흐름에서 사용자/토큰/검증 상태를 조율한다.
 */
@Component
@RequiredArgsConstructor
public class AuthBusiness {

    private final UserMapper userMapper;
    private final UserOAuthIdentityMapper userOAuthIdentityMapper;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordEncoder passwordEncoder;
    private final AuthProperties authProperties;
    private final AuthJwtProperties authJwtProperties;
    private final Environment environment;
    private final PrivacyConsentService privacyConsentService;
    private final MembershipService membershipService;

    /** 로컬 인증 정보를 검증하고 잠금 규칙을 적용한 뒤 토큰 세션을 발급한다. */
    public AuthSession login(LoginRequest request) {
        String username = request.getUsername().trim();
        UserRecord user = userMapper.findByUsername(username)
            .orElseThrow(() -> new ApiException(ApiErrorCode.AUTH_INVALID_CREDENTIALS));
        requireActive(user);

        if (isLocked(user)) {
            throw new ApiException(ApiErrorCode.AUTH_ACCOUNT_LOCKED);
        }

        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()
            || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            recordFailedLogin(user);
            throw new ApiException(ApiErrorCode.AUTH_INVALID_CREDENTIALS);
        }

        userMapper.resetLoginSuccess(user.getId());
        return issueSession(userMapper.findById(user.getId()).orElse(user));
    }

    /** 초대 코드 없이 로컬 계정을 등록하고 바로 토큰 세션을 발급한다. */
    @Transactional
    public AuthSession register(RegisterRequest request, String registrationIntentToken) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new ApiException(ApiErrorCode.AUTH_PASSWORD_CONFIRMATION_INVALID);
        }
        if (userMapper.findByUsername(username).isPresent()) {
            throw new ApiException(ApiErrorCode.AUTH_USERNAME_ALREADY_REGISTERED);
        }
        if (userMapper.findByEmail(email).isPresent()) {
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_ALREADY_REGISTERED);
        }
        privacyConsentService.consumeRegistrationIntent(registrationIntentToken);
        emailVerificationService.requireVerifiedCode(email, request.getEmailVerificationCode());

        UserRecord user = UserRecord.builder()
            .username(username)
            .displayName(request.getDisplayName().trim())
            .email(email)
            .emailVerified(true)
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .authProvider("local")
            .testData(isTestRuntime())
            .build();
        userMapper.insert(user);
        privacyConsentService.recordGrants(user.getId(), "LOCAL", user.isTestData());

        return issueSession(userMapper.findById(user.getId()).orElseThrow());
    }

    /** 회원가입 폼에서 이메일 중복 여부를 명시적으로 확인할 수 있게 한다. */
    public EmailAvailabilityResponse checkEmailAvailability(String email) {
        String normalizedEmail = normalizeEmail(email);
        return EmailAvailabilityResponse.builder()
            .email(normalizedEmail)
            .available(userMapper.findByEmail(normalizedEmail).isEmpty())
            .build();
    }

    /** refresh token을 회전시키고 새 access token 세션을 반환한다. */
    public AuthSession refresh(String rawRefreshToken) {
        RotationResult rotation = refreshTokenService.rotate(rawRefreshToken,
                id -> userMapper.findById(id).filter(user -> "ACTIVE".equals(user.getAccountStatus())))
            .orElseThrow(() -> new ApiException(ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID));
        return toSession(rotation.user(), rotation.refreshToken());
    }

    /** 현재 refresh token을 폐기하거나 사용자 식별자만 알 때는 모든 사용자 토큰을 폐기한다. */
    public void logout(String rawRefreshToken, Long userId) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokenService.revokeRawToken(rawRefreshToken);
            return;
        }
        if (userId != null) {
            refreshTokenService.revokeAllForUser(userId);
        }
    }

    /** /me에서 보여줄 현재 사용자 payload를 조회한다. */
    public MeResponse currentUser(Long userId) {
        UserRecord user = userMapper.findById(userId)
            .orElseThrow(() -> new ApiException(ApiErrorCode.COMMON_UNAUTHORIZED));
        return MeResponse.builder()
            .userId(user.getId())
            .username(user.getUsername())
            .displayName(user.getDisplayName())
            .email(user.getEmail())
            .emailVerified(user.isEmailVerified())
            .authProvider(user.getAuthProvider())
            .build();
    }

    /** 기존 Google 식별자로 로그인하고 세션을 발급한다. */
    public AuthSession loginGoogleUser(
        String providerSubject,
        String email,
        boolean emailVerified,
        String displayName
    ) {
        Optional<UserOAuthIdentityRecord> existingIdentity = userOAuthIdentityMapper.findByProviderSubject("google", providerSubject);
        if (existingIdentity.isPresent()) {
            UserRecord user = userMapper.findById(existingIdentity.get().getUserId())
                .orElseThrow(() -> new ApiException(ApiErrorCode.AUTH_LINKED_USER_NOT_FOUND));
            requireActive(user);
            userMapper.resetLoginSuccess(user.getId());
            return issueSession(user);
        }

        throw new ApiException(ApiErrorCode.AUTH_GOOGLE_REGISTRATION_REQUIRED);
    }

    public boolean hasGoogleIdentity(String providerSubject) {
        return userOAuthIdentityMapper.findByProviderSubject("google", providerSubject).isPresent();
    }

    @Transactional
    public AuthSession completeGoogleRegistration(String pendingToken, ConsentRequest consent) {
        privacyConsentService.validate(consent);
        var pending = privacyConsentService.requireGoogleRegistration(pendingToken);
        if (hasGoogleIdentity(pending.subject())) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_ACCOUNT_ALREADY_EXISTS);
        }
        String email = pending.email();
        if (email != null && !email.isBlank()) {
            Optional<UserRecord> emailMatch = userMapper.findByEmail(email.toLowerCase(Locale.ROOT));
            if (emailMatch.isPresent()) {
                throw new ApiException(ApiErrorCode.AUTH_GOOGLE_LINK_REQUIRED);
            }
        }

        privacyConsentService.consumeGoogleRegistration(pendingToken);
        String normalizedEmail = email == null ? null : email.toLowerCase(Locale.ROOT);
        String username = buildGoogleUsername(normalizedEmail, pending.subject());
        UserRecord user = UserRecord.builder()
            .username(username)
            .displayName(pending.displayName() == null || pending.displayName().isBlank()
                ? username : pending.displayName().trim())
            .email(normalizedEmail)
            .emailVerified(pending.emailVerified())
            .passwordHash(null)
            .authProvider("google")
            .testData(isTestRuntime())
            .build();
        userMapper.insert(user);

        userOAuthIdentityMapper.insert(UserOAuthIdentityRecord.builder()
            .userId(user.getId())
            .provider("google")
            .providerSubject(pending.subject())
            .providerEmail(normalizedEmail)
            .build());
        privacyConsentService.recordGrants(user.getId(), "GOOGLE", user.isTestData());

        return issueSession(userMapper.findById(user.getId()).orElseThrow());
    }

    /** 충돌 검사를 거친 뒤 인증된 계정에 Google 식별자를 연결한다. */
    public void linkGoogleAccount(Long userId, String providerSubject, String email, boolean emailVerified) {
        UserRecord user = userMapper.findById(userId)
            .orElseThrow(() -> new ApiException(ApiErrorCode.COMMON_UNAUTHORIZED));

        if (userOAuthIdentityMapper.findByUserAndProvider(userId, "google").isPresent()) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_ALREADY_LINKED);
        }

        if (userOAuthIdentityMapper.findByProviderSubject("google", providerSubject).isPresent()) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_LINKED_TO_ANOTHER_USER);
        }

        String normalizedEmail = email == null ? null : email.toLowerCase(Locale.ROOT);
        if (normalizedEmail != null && !normalizedEmail.isBlank()) {
            userMapper.findByEmail(normalizedEmail).ifPresent(existing -> {
                if (!existing.getId().equals(userId)) {
                    throw new ApiException(ApiErrorCode.AUTH_GOOGLE_LINKED_TO_ANOTHER_USER);
                }
            });
        }

        userOAuthIdentityMapper.insert(UserOAuthIdentityRecord.builder()
            .userId(userId)
            .provider("google")
            .providerSubject(providerSubject)
            .providerEmail(normalizedEmail)
            .build());

        String authProvider = "local".equals(user.getAuthProvider()) ? "local+google" : user.getAuthProvider();
        userMapper.updateAuthProvider(userId, authProvider, emailVerified);
    }

    /** 사용자 레코드 하나에서 access token과 refresh token을 함께 발급한다. */
    private AuthSession issueSession(UserRecord user) {
        requireActive(user);
        IssuedRefreshToken refreshToken = refreshTokenService.issue(user);
        return toSession(user, refreshToken);
    }

    private void requireActive(UserRecord user) {
        if (!"ACTIVE".equals(user.getAccountStatus())) {
            throw new ApiException(ApiErrorCode.AUTH_ACCOUNT_INACTIVE);
        }
    }

    /** 토큰 서비스 출력을 로그인 DTO와 원문 refresh-token 쿠키 값으로 변환한다. */
    private AuthSession toSession(UserRecord user, IssuedRefreshToken refreshToken) {
        LoginResponse response = LoginResponse.builder()
            .userId(user.getId())
            .username(user.getUsername())
            .displayName(user.getDisplayName())
            .authMode(resolveAuthMode(user.getAuthProvider()))
            .accessToken(jwtTokenService.createAccessToken(user))
            .accessTokenExpiresInSeconds(authJwtProperties.getAccessTtlSeconds())
            .consentRequired(privacyConsentService.isConsentRequiredForSession(user.getId()))
            .membershipTier(membershipService.tierFor(user.getId()).name())
            .build();
        return new AuthSession(response, refreshToken.rawToken());
    }

    /** 잠금 시각을 임시 로그인 거부 상태로 취급한다. */
    private boolean isLocked(UserRecord user) {
        return user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now());
    }

    /** 로그인 실패 횟수를 늘리고 설정된 임계값에 도달하면 잠금 시각을 설정한다. */
    private void recordFailedLogin(UserRecord user) {
        int failedCount = user.getFailedLoginCount() + 1;
        Instant lockedUntil = failedCount >= authProperties.getMaxFailedLogins()
            ? Instant.now().plus(authProperties.getLockoutMinutes(), ChronoUnit.MINUTES)
            : user.getLockedUntil();

        userMapper.updateLoginFailure(UserRecord.builder()
            .id(user.getId())
            .failedLoginCount(failedCount)
            .lockedUntil(lockedUntil)
            .build());
    }

    /** 백엔드 제공자 상태에서 클라이언트가 읽을 인증 모드를 노출한다. */
    private String resolveAuthMode(String authProvider) {
        if ("google".equals(authProvider)) {
            return "google-oauth-jwt";
        }
        if ("local+google".equals(authProvider)) {
            return "local-google-jwt";
        }
        return "local-jwt";
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ApiErrorCode.AUTH_EMAIL_REQUIRED);
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /** local/test profile에서 생성한 계정은 reset API가 정리할 수 있게 표시한다. */
    private boolean isTestRuntime() {
        return environment.acceptsProfiles(Profiles.of("local", "test"));
    }

    /** 이메일 연결 없이 새 Google 전용 계정의 안정적인 사용자 이름을 만든다. */
    private String buildGoogleUsername(String email, String providerSubject) {
        if (email != null && email.contains("@")) {
            String localPart = email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9._-]", "");
            if (!localPart.isBlank()) {
                String candidate = localPart;
                if (userMapper.findByUsername(candidate).isEmpty()) {
                    return candidate;
                }
                candidate = localPart + "-" + providerSubject.substring(0, Math.min(6, providerSubject.length()));
                if (userMapper.findByUsername(candidate).isEmpty()) {
                    return candidate;
                }
            }
        }
        return "google-" + providerSubject.substring(0, Math.min(24, providerSubject.length()));
    }

    public record AuthSession(LoginResponse loginResponse, String refreshToken) {
    }
}
