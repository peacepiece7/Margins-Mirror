package com.margins.auth.controller;

import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.config.AuthCookieProperties;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.security.MarginsUserPrincipal;
import com.margins.auth.service.AuthService;
import com.margins.auth.service.GoogleOAuthService;
import com.margins.auth.service.GoogleOAuthService.GoogleUserProfile;
import com.margins.auth.support.AuthCookieSupport;
import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.service.PrivacyConsentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Google OAuth REST API 진입점이다.
 * 인가 URL 생성, 콜백 처리, 기존 계정 연동 요청을 인증 서비스로 연결한다.
 */
@RestController
@RequestMapping("/api/auth/oauth/google")
@RequiredArgsConstructor
public class GoogleOAuthController {

    private static final String MODE_LINK = "link";
    private static final String MODE_LOGIN = "login";
    private static final Map<String, PendingOAuthState> PENDING_STATES = new ConcurrentHashMap<>();

    private final GoogleOAuthService googleOAuthService;
    private final GoogleAuthProperties googleAuthProperties;
    private final AuthService authService;
    private final AuthCookieSupport authCookieSupport;
    private final AuthCookieProperties authCookieProperties;
    private final AuthJwtProperties authJwtProperties;
    private final PrivacyConsentService privacyConsentService;

    /**
     * Google OAuth 로그인 또는 연동 플로우를 시작하고 Google 인가 URL로 redirect하는 GET 엔드포인트다.
     */
    @GetMapping("/start")
    public void start(
        @RequestParam(name = "mode", defaultValue = MODE_LOGIN) String mode,
        @AuthenticationPrincipal MarginsUserPrincipal principal,
        HttpServletResponse response
    ) throws IOException {
        googleOAuthService.requireEnabled();

        if (MODE_LINK.equalsIgnoreCase(mode)) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_LINKING_UNAVAILABLE);
        }
        String state = googleOAuthService.createState();
        // ConcurrentHashMap에 state(SecureRandom으로 생성한 예측 불가능한 랜덤 문자열)를 저장한다.
        // 함께 OAuth 모드와 생성 시각도 보관한다.
        PENDING_STATES.put(state, new PendingOAuthState(
            MODE_LINK.equalsIgnoreCase(mode) ? MODE_LINK : MODE_LOGIN,
            principal == null ? null : principal.getUserId(),
            System.currentTimeMillis()
        ));

        // state 값을 10분 동안 유효한 HttpOnly 쿠키로 발급
        authCookieSupport.writeOAuthStateCookie(
            response,
            state,
            Duration.ofMinutes(10)
        );

        // Google 인증에 필요한 query parameter를 포함한 URL로 브라우저를 redirect한다.
        response.sendRedirect(googleOAuthService.buildAuthorizationUrl(state, mode));
    }

    /**
     * Google OAuth callback을 받아 로그인/연동을 완료하고 프론트 callback URL로 redirect하는 GET 엔드포인트다.
     */
    @GetMapping("/callback")
    public void callback(
        @RequestParam(name = "code", required = false) String code, // 구글이 발급한 1회용 인가 코드
        @RequestParam(name = "state", required = false) String state, // 우리 서버 /start에서 보냈던 state
        @RequestParam(name = "error", required = false) String error,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        googleOAuthService.requireEnabled();

        if (error != null && !error.isBlank()) {
            redirectWithError(response, providerErrorCode(error));
            return;
        }

        String cookieState = authCookieSupport.readCookieValue(request.getCookies(), authCookieProperties.getOauthStateName());
        if (state == null
            || cookieState == null
            || !state.equals(cookieState) // callback state와 쿠키 state가 같은지 확인한다.
        ) {
            redirectWithError(response, ApiErrorCode.AUTH_GOOGLE_OAUTH_STATE_INVALID);
            return;
        }

        // PENDING_STATES에서 검증이 끝난 state를 제거한다.
        PendingOAuthState pending = PENDING_STATES.remove(state);
        authCookieSupport.clearOAuthStateCookie(response);
        if (pending == null || code == null || code.isBlank()) {
            redirectWithError(response, ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID);
            return;
        }

        try {
            GoogleUserProfile profile = googleOAuthService.exchangeAuthorizationCode(code);
            if (MODE_LINK.equals(pending.mode())) {
                authService.linkGoogleAccount(
                    pending.userId(),
                    profile.subject(),
                    profile.email(),
                    profile.emailVerified()
                );
                response.sendRedirect(googleAuthProperties.getFrontendCallbackUrl() + "?link=success");
                return;
            }

            // profile에 고유 아이디(subject)가 db(user_oauth_identities)에 저장이 안되어 있을 경우
            // 이용약관을 받는 페이지로 redirect 시킴
            if (!authService.hasGoogleIdentity(profile.subject())) {
                String registrationToken = privacyConsentService.createGoogleRegistration(
                    profile.subject(), profile.email(), profile.emailVerified(), profile.displayName());
                authCookieSupport.writeGoogleRegistrationCookie(
                    response, registrationToken, Duration.ofMinutes(10));
                response.sendRedirect(googleAuthProperties.getFrontendCallbackUrl() + "?registration=required");
                return;
            }

            AuthSession session = authService.loginGoogleUser(
                profile.subject(),
                profile.email(),
                profile.emailVerified(),
                profile.displayName()
            );
            authCookieSupport.writeRefreshCookie(
                response,
                session.refreshToken(),
                Duration.ofSeconds(authJwtProperties.getRefreshTtlSeconds())
            );
            response.sendRedirect(googleAuthProperties.getFrontendCallbackUrl() + "?login=success");
        } catch (ResponseStatusException exception) {
            ApiErrorCode errorCode = exception instanceof ApiException apiException
                ? apiException.getCode()
                : ApiErrorCode.fromStatus(exception.getStatusCode().value());
            redirectWithError(response, errorCode);
        }
    }

    @PostMapping("/registrations")
    public ApiResponse<com.margins.auth.dto.LoginResponse> completeRegistration(
        @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody ConsentRequest consent,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        String pendingToken = authCookieSupport.readCookieValue(
            request.getCookies(), authCookieProperties.getGoogleRegistrationName());
        AuthSession session = authService.completeGoogleRegistration(pendingToken, consent);
        authCookieSupport.clearGoogleRegistrationCookie(response);
        authCookieSupport.writeRefreshCookie(
            response, session.refreshToken(), Duration.ofSeconds(authJwtProperties.getRefreshTtlSeconds()));
        return ApiResponse.ok(session.loginResponse());
    }

    /**
     * 프론트에서 받은 Google ID token으로 현재 계정에 Google 로그인을 연결하는 POST 엔드포인트다.
     */
    private ApiErrorCode providerErrorCode(String providerError) {
        return "access_denied".equals(providerError)
            ? ApiErrorCode.AUTH_GOOGLE_OAUTH_CANCELLED
            : ApiErrorCode.AUTH_GOOGLE_OAUTH_REQUEST_INVALID;
    }

    private void redirectWithError(HttpServletResponse response, ApiErrorCode errorCode) throws IOException {
        response.sendRedirect(
            googleAuthProperties.getFrontendCallbackUrl()
                + "?error="
                + URLEncoder.encode(errorCode.name(), StandardCharsets.UTF_8)
        );
    }

    private record PendingOAuthState(String mode, Long userId, long createdAtEpochMs) {
    }
}
