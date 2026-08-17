package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.auth.config.AuthCookieProperties;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.controller.GoogleOAuthController;
import com.margins.auth.service.AuthService;
import com.margins.auth.service.GoogleOAuthService;
import com.margins.auth.service.GoogleOAuthService.GoogleUserProfile;
import com.margins.auth.support.AuthCookieSupport;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.service.PrivacyConsentService;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class GoogleOAuthControllerTest {

    @Test
    void callbackCreatesPendingRegistrationWithoutCreatingAccount() throws Exception {
        GoogleOAuthService google = mock(GoogleOAuthService.class);
        GoogleAuthProperties googleProperties = new GoogleAuthProperties();
        googleProperties.setFrontendCallbackUrl("https://margins.test/auth/callback");
        AuthService authService = mock(AuthService.class);
        AuthCookieSupport cookies = mock(AuthCookieSupport.class);
        AuthCookieProperties cookieProperties = new AuthCookieProperties();
        cookieProperties.setOauthStateName("oauth-state");
        AuthJwtProperties jwtProperties = new AuthJwtProperties();
        PrivacyConsentService privacy = mock(PrivacyConsentService.class);
        GoogleOAuthController controller = new GoogleOAuthController(
            google,
            googleProperties,
            authService,
            cookies,
            cookieProperties,
            jwtProperties,
            privacy
        );
        when(google.createState()).thenReturn("state-123");
        when(google.buildAuthorizationUrl("state-123", "login")).thenReturn("https://google.test/authorize");
        when(cookies.readCookieValue(any(), eq("oauth-state"))).thenReturn("state-123");
        when(google.exchangeAuthorizationCode("code-123")).thenReturn(
            new GoogleUserProfile("google-subject", "reader@example.com", true, "Reader")
        );
        when(authService.hasGoogleIdentity("google-subject")).thenReturn(false);
        when(privacy.createGoogleRegistration(
            "google-subject", "reader@example.com", true, "Reader"
        )).thenReturn("pending-token");

        MockHttpServletResponse startResponse = new MockHttpServletResponse();
        controller.start("login", null, startResponse);
        assertThat(startResponse.getRedirectedUrl()).isEqualTo("https://google.test/authorize");

        MockHttpServletResponse callbackResponse = new MockHttpServletResponse();
        controller.callback(
            "code-123",
            "state-123",
            null,
            new MockHttpServletRequest(),
            callbackResponse
        );

        verify(cookies).writeGoogleRegistrationCookie(
            eq(callbackResponse), eq("pending-token"), eq(Duration.ofMinutes(10)));
        verify(authService, never()).loginGoogleUser(any(), any(), anyBoolean(), any());
        assertThat(callbackResponse.getRedirectedUrl())
            .isEqualTo("https://margins.test/auth/callback?registration=required");
    }

    @Test
    void callbackRedirectsWithTheStableErrorCode() throws Exception {
        GoogleOAuthService google = mock(GoogleOAuthService.class);
        GoogleAuthProperties googleProperties = new GoogleAuthProperties();
        googleProperties.setFrontendCallbackUrl("https://margins.test/auth/callback");
        AuthService authService = mock(AuthService.class);
        AuthCookieSupport cookies = mock(AuthCookieSupport.class);
        AuthCookieProperties cookieProperties = new AuthCookieProperties();
        cookieProperties.setOauthStateName("oauth-state");
        GoogleOAuthController controller = new GoogleOAuthController(
            google,
            googleProperties,
            authService,
            cookies,
            cookieProperties,
            new AuthJwtProperties(),
            mock(PrivacyConsentService.class)
        );
        when(google.createState()).thenReturn("state-error");
        when(google.buildAuthorizationUrl("state-error", "login")).thenReturn("https://google.test/authorize");
        when(cookies.readCookieValue(any(), eq("oauth-state"))).thenReturn("state-error");
        when(google.exchangeAuthorizationCode("code-error"))
            .thenThrow(new ApiException(ApiErrorCode.AUTH_GOOGLE_LINK_REQUIRED));

        controller.start("login", null, new MockHttpServletResponse());
        MockHttpServletResponse callbackResponse = new MockHttpServletResponse();
        controller.callback(
            "code-error",
            "state-error",
            null,
            new MockHttpServletRequest(),
            callbackResponse
        );

        assertThat(callbackResponse.getRedirectedUrl())
            .isEqualTo("https://margins.test/auth/callback?error=AUTH_GOOGLE_LINK_REQUIRED");
    }

    @Test
    void callbackNormalizesProviderAndStateFailuresToPublicErrorCodes() throws Exception {
        GoogleOAuthService google = mock(GoogleOAuthService.class);
        GoogleAuthProperties googleProperties = new GoogleAuthProperties();
        googleProperties.setFrontendCallbackUrl("https://margins.test/auth/callback");
        AuthCookieSupport cookies = mock(AuthCookieSupport.class);
        AuthCookieProperties cookieProperties = new AuthCookieProperties();
        cookieProperties.setOauthStateName("oauth-state");
        GoogleOAuthController controller = new GoogleOAuthController(
            google,
            googleProperties,
            mock(AuthService.class),
            cookies,
            cookieProperties,
            new AuthJwtProperties(),
            mock(PrivacyConsentService.class)
        );

        MockHttpServletResponse deniedResponse = new MockHttpServletResponse();
        controller.callback(null, null, "access_denied", new MockHttpServletRequest(), deniedResponse);
        assertThat(deniedResponse.getRedirectedUrl())
            .isEqualTo("https://margins.test/auth/callback?error=AUTH_GOOGLE_OAUTH_CANCELLED");

        when(cookies.readCookieValue(any(), eq("oauth-state"))).thenReturn("expected-state");
        MockHttpServletResponse invalidStateResponse = new MockHttpServletResponse();
        controller.callback(
            "code",
            "wrong-state",
            null,
            new MockHttpServletRequest(),
            invalidStateResponse
        );
        assertThat(invalidStateResponse.getRedirectedUrl())
            .isEqualTo("https://margins.test/auth/callback?error=AUTH_GOOGLE_OAUTH_STATE_INVALID");

        when(cookies.readCookieValue(any(), eq("oauth-state"))).thenReturn("orphan-state");
        MockHttpServletResponse invalidRequestResponse = new MockHttpServletResponse();
        controller.callback(
            "code",
            "orphan-state",
            null,
            new MockHttpServletRequest(),
            invalidRequestResponse
        );
        assertThat(invalidRequestResponse.getRedirectedUrl())
            .isEqualTo("https://margins.test/auth/callback?error=AUTH_GOOGLE_OAUTH_REQUEST_INVALID");
    }
}
