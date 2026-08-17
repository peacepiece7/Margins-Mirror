package com.margins.auth.controller;

import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.config.AuthCookieProperties;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.dto.EmailAvailabilityResponse;
import com.margins.auth.dto.EmailVerificationConfirmRequest;
import com.margins.auth.dto.EmailVerificationConfirmResponse;
import com.margins.auth.dto.EmailVerificationRequest;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.auth.dto.LoginRequest;
import com.margins.auth.dto.LoginResponse;
import com.margins.auth.dto.MeResponse;
import com.margins.auth.dto.RegisterRequest;
import com.margins.auth.security.MarginsUserPrincipal;
import com.margins.auth.service.AuthService;
import com.margins.auth.support.AuthCookieSupport;
import com.margins.auth.support.AuthContext;
import com.margins.auth.support.ClientIpResolver;
import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.service.PrivacyConsentService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 REST API 진입점이다.
 * 로그인, 회원가입, 이메일 인증, 토큰 재발급, 내 정보 조회 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthCookieSupport authCookieSupport;
    private final AuthCookieProperties authCookieProperties;
    private final AuthJwtProperties authJwtProperties;
    private final PrivacyConsentService privacyConsentService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/registration-intents")
    public ApiResponse<Void> createRegistrationIntent(
        @Valid @RequestBody ConsentRequest request,
        HttpServletResponse response
    ) {
        String token = privacyConsentService.createRegistrationIntent(request);
        authCookieSupport.writeRegistrationIntentCookie(response, token, Duration.ofMinutes(10));
        return ApiResponse.ok(null);
    }

    /** 이메일/전화번호와 비밀번호로 로그인하고 refresh cookie를 발급하는 POST 엔드포인트다. */
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletResponse response
    ) {
        AuthSession session = authService.login(request);
        writeRefreshCookie(response, session.refreshToken());
        return ApiResponse.ok(session.loginResponse());
    }

    /** 신규 계정을 생성하고 즉시 로그인 세션을 발급하는 POST 엔드포인트다. */
    @PostMapping("/register")
    public ApiResponse<LoginResponse> register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        String intent = authCookieSupport.readCookieValue(
            httpRequest.getCookies(), authCookieProperties.getRegistrationIntentName()
        );
        AuthSession session = authService.register(request, intent);
        authCookieSupport.clearRegistrationIntentCookie(response);
        writeRefreshCookie(response, session.refreshToken());
        return ApiResponse.ok(session.loginResponse());
    }

    /** 회원가입용 이메일 인증 코드를 발급하는 POST 엔드포인트다. */
    @PostMapping("/email-verifications")
    public ApiResponse<EmailVerificationResponse> issueEmailVerificationCode(
        @Valid @RequestBody EmailVerificationRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(authService.issueEmailVerificationCode(
            request.getEmail(),
            request.getBotChallengeToken(),
            clientIpResolver.resolve(httpRequest)
        ));
    }

    /** 이메일 인증 코드를 확인하고 검증 결과를 반환하는 POST 엔드포인트다. */
    @PostMapping("/email-verifications/confirm")
    public ApiResponse<EmailVerificationConfirmResponse> confirmEmailVerificationCode(
        @Valid @RequestBody EmailVerificationConfirmRequest request
    ) {
        return ApiResponse.ok(authService.verifyEmailCode(request.getEmail(), request.getCode()));
    }

    /** 이메일 중복 여부를 확인하는 GET 엔드포인트다. */
    @GetMapping("/email-availability")
    public ApiResponse<EmailAvailabilityResponse> checkEmailAvailability(
        @RequestParam("email") String email
    ) {
        return ApiResponse.ok(authService.checkEmailAvailability(email));
    }

    /** refresh cookie로 새 액세스 토큰과 refresh token을 발급하는 POST 엔드포인트다. */
    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = authCookieSupport.readCookieValue(request.getCookies(), authCookieProperties.getRefreshName());
        if (refreshToken == null) {
            throw new ApiException(ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID, "missing refresh token");
        }
        AuthSession session = authService.refresh(refreshToken);
        writeRefreshCookie(response, session.refreshToken());
        return ApiResponse.ok(session.loginResponse());
    }

    /** 현재 refresh token을 폐기하고 인증 cookie를 지우는 POST 엔드포인트다. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(
        HttpServletRequest request,
        HttpServletResponse response,
        @AuthenticationPrincipal MarginsUserPrincipal principal
    ) {
        String refreshToken = authCookieSupport.readCookieValue(request.getCookies(), authCookieProperties.getRefreshName());
        authService.logout(refreshToken, principal == null ? null : principal.getUserId());
        authCookieSupport.clearRefreshCookie(response);
        return ApiResponse.ok(null);
    }

    /** 현재 인증된 사용자 정보를 조회하는 GET 엔드포인트다. */
    @GetMapping("/me")
    public ApiResponse<MeResponse> me(HttpServletRequest request) {
        return ApiResponse.ok(authService.currentUser(AuthContext.requireUserId(request)));
    }

    private void writeRefreshCookie(HttpServletResponse response, String refreshToken) {
        authCookieSupport.writeRefreshCookie(
            response,
            refreshToken,
            Duration.ofSeconds(authJwtProperties.getRefreshTtlSeconds())
        );
    }
}
