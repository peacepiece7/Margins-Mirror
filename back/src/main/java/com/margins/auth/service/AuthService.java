package com.margins.auth.service;

import com.margins.auth.business.AuthBusiness;
import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.dto.EmailAvailabilityResponse;
import com.margins.auth.dto.EmailVerificationConfirmResponse;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.auth.dto.LoginRequest;
import com.margins.auth.dto.MeResponse;
import com.margins.auth.dto.RegisterRequest;
import com.margins.privacy.dto.ConsentRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 컨트롤러와 인증 비즈니스 로직 사이의 서비스 계층이다.
 * 요청 DTO를 업무 흐름에 맞게 위임하고 응답 DTO로 반환한다.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthBusiness authBusiness;
    private final EmailVerificationService emailVerificationService;

    public AuthSession login(LoginRequest request) {
        return authBusiness.login(request);
    }

    public EmailVerificationResponse issueEmailVerificationCode(
        String email,
        String botChallengeToken,
        String clientIp
    ) {
        return emailVerificationService.issueCode(email, botChallengeToken, clientIp);
    }

    public EmailVerificationConfirmResponse verifyEmailCode(String email, String code) {
        return emailVerificationService.verifyCode(email, code);
    }

    public EmailAvailabilityResponse checkEmailAvailability(String email) {
        return authBusiness.checkEmailAvailability(email);
    }

    public AuthSession register(RegisterRequest request, String registrationIntentToken) {
        return authBusiness.register(request, registrationIntentToken);
    }

    public AuthSession refresh(String rawRefreshToken) {
        return authBusiness.refresh(rawRefreshToken);
    }

    public void logout(String rawRefreshToken, Long userId) {
        authBusiness.logout(rawRefreshToken, userId);
    }

    public MeResponse currentUser(Long userId) {
        return authBusiness.currentUser(userId);
    }

    public AuthSession loginGoogleUser(
        String providerSubject,
        String email,
        boolean emailVerified,
        String displayName
    ) {
        return authBusiness.loginGoogleUser(providerSubject, email, emailVerified, displayName);
    }

    public void linkGoogleAccount(Long userId, String providerSubject, String email, boolean emailVerified) {
        authBusiness.linkGoogleAccount(userId, providerSubject, email, emailVerified);
    }

    public boolean hasGoogleIdentity(String providerSubject) {
        return authBusiness.hasGoogleIdentity(providerSubject);
    }

    public AuthSession completeGoogleRegistration(String pendingToken, ConsentRequest consent) {
        return authBusiness.completeGoogleRegistration(pendingToken, consent);
    }
}
