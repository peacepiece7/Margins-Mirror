package com.margins.auth.controller;

import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.dto.NativeGoogleOAuthExchangeRequest;
import com.margins.auth.dto.NativeGoogleOAuthExchangeResponse;
import com.margins.auth.dto.NativeGoogleRegistrationRequest;
import com.margins.auth.dto.NativeSessionResponse;
import com.margins.auth.service.AuthService;
import com.margins.auth.service.GoogleOAuthService;
import com.margins.auth.service.GoogleOAuthService.GoogleUserProfile;
import com.margins.auth.service.NativeGoogleOAuthStateService;
import com.margins.auth.service.NativeGoogleOAuthStateService.NativeAuthorization;
import com.margins.auth.service.NativeGoogleOAuthStateService.PendingExchange;
import com.margins.auth.service.NativeGoogleOAuthStateService.PendingState;
import com.margins.auth.support.ClientIpResolver;
import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.service.PrivacyConsentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

/** Native Google OAuth bridge. Redirects expose only a short-lived, one-time exchange code. */
@RestController
@RequestMapping("/api/mobile/auth/oauth/google")
@RequiredArgsConstructor
@Slf4j
public class MobileGoogleOAuthController {
    private final GoogleOAuthService googleOAuthService;
    private final GoogleAuthProperties properties;
    private final NativeGoogleOAuthStateService stateService;
    private final AuthService authService;
    private final PrivacyConsentService privacyConsentService;
    private final AuthJwtProperties jwtProperties;
    private final ClientIpResolver clientIpResolver;
    private final Environment environment;

    /** [Mobile API] 앱 redirect URI와 PKCE challenge를 검증하고 Google 인가 화면으로 이동한다. */
    @GetMapping("/start")
    public void start(
        @RequestParam String redirectUri,
        @RequestParam String codeChallenge,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        startForCaller(redirectUri, codeChallenge, clientIpResolver.resolve(request), response);
    }

    public void start(
        String redirectUri,
        String codeChallenge,
        HttpServletResponse response
    ) throws IOException {
        startForCaller(redirectUri, codeChallenge, "direct-test", response);
    }

    private void startForCaller(
        String redirectUri,
        String codeChallenge,
        String callerKey,
        HttpServletResponse response
    ) throws IOException {
        requireNativeEnabled();
        String allowedRedirect = requireAllowedRedirect(redirectUri);
        NativeAuthorization pending = stateService.begin(allowedRedirect, codeChallenge, callerKey);
        response.sendRedirect(googleOAuthService.buildNativeAuthorizationUrl(
            pending.state(), pending.nonce(), pending.codeChallenge()));
    }

    /** [Mobile API] Google callback을 처리하고 앱에 일회성 exchange code만 전달한다. */
    @GetMapping("/callback")
    public void callback(
        @RequestParam(required = false) String code,
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String error,
        HttpServletResponse response
    ) throws IOException {
        requireNativeEnabled();
        PendingState pending = stateService.consumeState(state);
        if (error != null && !error.isBlank()) {
            redirect(pending.redirectUri(), "error", "access_denied".equals(error)
                ? ApiErrorCode.AUTH_GOOGLE_OAUTH_CANCELLED.name()
                : ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID.name(), response);
            return;
        }
        if (code == null || code.isBlank()) {
            redirect(pending.redirectUri(), "error", ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID.name(), response);
            return;
        }

        try {
            GoogleUserProfile profile = googleOAuthService.exchangeNativeAuthorizationCode(
                code, pending.codeVerifier(), pending.nonce());
            String exchangeCode = stateService.issueProfile(profile, pending.deviceChallenge());
            redirect(pending.redirectUri(), "code", exchangeCode, response);
        } catch (ApiException exception) {
            redirect(pending.redirectUri(), "error", exception.getCode().name(), response);
        } catch (RuntimeException exception) {
            String incidentId = UUID.randomUUID().toString();
            log.error("Native Google OAuth callback failed incidentId={} type={}",
                incidentId, exception.getClass().getSimpleName());
            redirect(pending.redirectUri(), "error", ApiErrorCode.COMMON_INTERNAL_ERROR.name(), response);
        }
    }

    /** [Mobile API] 일회성 code와 verifier를 세션 또는 가입 대기 상태로 교환한다. */
    @PostMapping("/exchange")
    public ResponseEntity<ApiResponse<NativeGoogleOAuthExchangeResponse>> exchange(
        @Valid @RequestBody NativeGoogleOAuthExchangeRequest request
    ) {
        requireNativeEnabled();
        PendingExchange pending = stateService.consumeExchange(
            request.getCode(), request.getVerifier());
        GoogleUserProfile profile = pending.profile();
        if (authService.hasGoogleIdentity(profile.subject())) {
            AuthSession session = authService.loginGoogleUser(
                profile.subject(), profile.email(), profile.emailVerified(), profile.displayName());
            return noStore(ApiResponse.ok(NativeGoogleOAuthExchangeResponse.builder()
                .status("SESSION")
                .session(toNativeSession(session))
                .build()));
        }
        String registration = privacyConsentService.createGoogleRegistration(
            profile.subject(), profile.email(), profile.emailVerified(), profile.displayName());
        return noStore(ApiResponse.ok(NativeGoogleOAuthExchangeResponse.builder()
            .status("REGISTRATION_REQUIRED")
            .pendingRegistrationToken(registration)
            .build()));
    }

    /** [Mobile API] Google 신규 사용자의 동의를 검증하고 네이티브 세션을 발급한다. */
    @PostMapping("/registrations")
    public ResponseEntity<ApiResponse<NativeSessionResponse>> register(
        @Valid @RequestBody NativeGoogleRegistrationRequest request
    ) {
        requireNativeEnabled();
        return noStore(ApiResponse.ok(toNativeSession(authService.completeGoogleRegistration(
            request.getPendingRegistrationToken(), request.toConsentRequest()))));
    }

    private NativeSessionResponse toNativeSession(AuthSession session) {
        return NativeSessionResponse.from(
            session.loginResponse(), session.refreshToken(), jwtProperties.getRefreshTtlSeconds());
    }

    private <T> ResponseEntity<ApiResponse<T>> noStore(ApiResponse<T> response) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.PRAGMA, "no-cache")
            .body(response);
    }

    private void requireNativeEnabled() {
        googleOAuthService.requireEnabled();
        if (!properties.isMobileEnabled()) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_NOT_CONFIGURED);
        }
    }

    private String requireAllowedRedirect(String redirectUri) {
        if (redirectUri == null || !properties.getMobileRedirectUris().contains(redirectUri)) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
        }
        final URI parsed;
        try {
            parsed = URI.create(redirectUri);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
        }
        if (!parsed.isAbsolute()
            || parsed.getFragment() != null
            || parsed.getQuery() != null
            || parsed.getUserInfo() != null
            || (!isLocalOrTest() && (!"https".equalsIgnoreCase(parsed.getScheme())
                || parsed.getHost() == null))) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
        }
        return redirectUri;
    }

    private boolean isLocalOrTest() {
        return environment.acceptsProfiles(Profiles.of("local", "test"));
    }

    private void redirect(String base, String name, String value, HttpServletResponse response) throws IOException {
        String separator = base.contains("?") ? "&" : "?";
        response.sendRedirect(base + separator + name + "="
            + URLEncoder.encode(value, StandardCharsets.UTF_8));
    }
}
