package com.margins.auth.controller;

import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.dto.LoginRequest;
import com.margins.auth.dto.EmailAvailabilityResponse;
import com.margins.auth.dto.MobileEmailAvailabilityRequest;
import com.margins.auth.dto.MobileRegisterRequest;
import com.margins.auth.dto.NativeRefreshTokenRequest;
import com.margins.auth.dto.NativeSessionResponse;
import com.margins.auth.dto.RegistrationIntentResponse;
import com.margins.auth.service.AuthService;
import com.margins.common.dto.ApiResponse;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.service.PrivacyConsentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 네이티브 앱이 쿠키 없이 인증 세션을 관리하는 REST 진입점이다.
 * 기존 인증 비즈니스 흐름을 재사용하고 refresh token만 네이티브 응답 본문으로 전달한다.
 */
@RestController
@RequestMapping("/api/mobile/auth")
@RequiredArgsConstructor
public class MobileAuthController {

    private final AuthService authService;
    private final AuthJwtProperties authJwtProperties;
    private final PrivacyConsentService privacyConsentService;

    /** [Mobile API] 이메일을 URL이나 access log에 남기지 않고 JSON body로 중복 여부를 확인한다. */
    @PostMapping("/email-availability")
    public ApiResponse<EmailAvailabilityResponse> checkEmailAvailability(
        @Valid @RequestBody MobileEmailAvailabilityRequest request
    ) {
        return ApiResponse.ok(authService.checkEmailAvailability(request.getEmail()));
    }

    /** [Mobile API] 필수 동의를 검증하고 네이티브 가입에 사용할 일회성 intent를 반환한다. */
    @PostMapping("/registration-intents")
    public ApiResponse<RegistrationIntentResponse> createRegistrationIntent(
        @Valid @RequestBody ConsentRequest request
    ) {
        String token = privacyConsentService.createRegistrationIntent(request);
        return ApiResponse.ok(RegistrationIntentResponse.builder()
            .registrationIntentToken(token)
            .build());
    }

    /** [Mobile API] 로컬 계정을 생성하고 쿠키 대신 네이티브 세션 본문을 반환한다. */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<NativeSessionResponse>> register(
        @Valid @RequestBody MobileRegisterRequest request
    ) {
        return nativeSession(authService.register(
            request.toRegisterRequest(),
            request.getRegistrationIntentToken()
        ));
    }

    /** [Mobile API] 로컬 자격 증명으로 로그인하고 쿠키 대신 네이티브 세션 본문을 반환한다. */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<NativeSessionResponse>> login(
        @Valid @RequestBody LoginRequest request
    ) {
        return nativeSession(authService.login(request));
    }

    /** [Mobile API] 요청 본문의 refresh token을 회전하고 새 네이티브 세션을 반환한다. */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<NativeSessionResponse>> refresh(
        @Valid @RequestBody NativeRefreshTokenRequest request
    ) {
        return nativeSession(authService.refresh(request.getRefreshToken()));
    }

    /** [Mobile API] access bearer 상태와 무관하게 요청 본문의 refresh token을 폐기한다. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody NativeRefreshTokenRequest request) {
        authService.logout(request.getRefreshToken(), null);
        return ApiResponse.ok(null);
    }

    private ResponseEntity<ApiResponse<NativeSessionResponse>> nativeSession(AuthSession session) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.PRAGMA, "no-cache")
            .body(ApiResponse.ok(NativeSessionResponse.from(
                session.loginResponse(),
                session.refreshToken(),
                authJwtProperties.getRefreshTtlSeconds()
            )));
    }
}
