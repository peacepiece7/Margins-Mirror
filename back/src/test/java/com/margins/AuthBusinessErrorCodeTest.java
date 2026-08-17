package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.auth.business.AuthBusiness;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.AuthProperties;
import com.margins.auth.dto.RegisterRequest;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.mapper.UserOAuthIdentityMapper;
import com.margins.auth.model.UserRecord;
import com.margins.auth.service.EmailVerificationService;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.service.RefreshTokenService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.membership.service.MembershipService;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.privacy.service.PrivacyConsentService.PendingGoogleRegistration;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthBusinessErrorCodeTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final UserOAuthIdentityMapper identityMapper = mock(UserOAuthIdentityMapper.class);
    private final PrivacyConsentService privacy = mock(PrivacyConsentService.class);
    private final AuthBusiness business = new AuthBusiness(
        userMapper,
        identityMapper,
        mock(JwtTokenService.class),
        mock(RefreshTokenService.class),
        mock(EmailVerificationService.class),
        mock(PasswordEncoder.class),
        new AuthProperties(),
        new AuthJwtProperties(),
        mock(Environment.class),
        privacy,
        mock(MembershipService.class)
    );

    @Test
    void GoogleRegistrationWithAnExistingEmailUsesTheLinkRequiredCode() {
        ConsentRequest consent = ConsentRequest.builder().build();
        when(privacy.requireGoogleRegistration("pending-token")).thenReturn(
            new PendingGoogleRegistration("google-subject", "reader@example.com", true, "Reader")
        );
        when(identityMapper.findByProviderSubject("google", "google-subject"))
            .thenReturn(Optional.empty());
        when(userMapper.findByEmail("reader@example.com"))
            .thenReturn(Optional.of(UserRecord.builder().id(7L).build()));

        assertThatThrownBy(() -> business.completeGoogleRegistration("pending-token", consent))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.AUTH_GOOGLE_LINK_REQUIRED));
    }

    @Test
    void localRegistrationDistinguishesEmailAndUsernameConflicts() {
        RegisterRequest request = RegisterRequest.builder()
            .username("reader")
            .email("reader@example.com")
            .password("long-enough-password")
            .confirmPassword("long-enough-password")
            .build();
        when(userMapper.findByUsername("reader")).thenReturn(Optional.of(UserRecord.builder().id(1L).build()));

        assertThatThrownBy(() -> business.register(request, "intent"))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.AUTH_USERNAME_ALREADY_REGISTERED));

        when(userMapper.findByUsername("reader")).thenReturn(Optional.empty());
        when(userMapper.findByEmail("reader@example.com"))
            .thenReturn(Optional.of(UserRecord.builder().id(2L).build()));

        assertThatThrownBy(() -> business.register(request, "intent"))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.AUTH_EMAIL_ALREADY_REGISTERED));
    }

    @Test
    void localRegistrationRequiresConsentIntentAtFinalSubmission() {
        RegisterRequest request = RegisterRequest.builder()
            .username("reader")
            .displayName("Reader")
            .email("reader@example.com")
            .emailVerificationCode("123456")
            .password("long-enough-password")
            .confirmPassword("long-enough-password")
            .build();
        doThrow(new ApiException(ApiErrorCode.PRIVACY_REGISTRATION_INTENT_INVALID))
            .when(privacy).consumeRegistrationIntent(null);

        assertThatThrownBy(() -> business.register(request, null))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode())
                    .isEqualTo(ApiErrorCode.PRIVACY_REGISTRATION_INTENT_INVALID));

        verify(privacy).consumeRegistrationIntent(null);
    }
}
