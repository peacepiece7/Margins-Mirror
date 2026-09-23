package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.controller.MobileGoogleOAuthController;
import com.margins.auth.dto.LoginResponse;
import com.margins.auth.dto.NativeGoogleOAuthExchangeRequest;
import com.margins.auth.service.AuthService;
import com.margins.auth.service.GoogleOAuthService;
import com.margins.auth.service.GoogleOAuthService.GoogleUserProfile;
import com.margins.auth.service.NativeGoogleOAuthStateService;
import com.margins.auth.support.ClientIpResolver;
import com.margins.common.error.ApiException;
import com.margins.privacy.service.PrivacyConsentService;
import java.util.List;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class MobileGoogleOAuthControllerTest {
    private static final String VERIFIER = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    private GoogleOAuthService google;
    private AuthService authService;
    private PrivacyConsentService privacy;
    private NativeGoogleOAuthStateService stateService;
    private MobileGoogleOAuthController controller;
    private GoogleAuthProperties properties;
    private ClientIpResolver clientIpResolver;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        google = mock(GoogleOAuthService.class);
        authService = mock(AuthService.class);
        privacy = mock(PrivacyConsentService.class);
        stateService = new NativeGoogleOAuthStateService();
        properties = new GoogleAuthProperties();
        properties.setMobileEnabled(true);
        properties.setMobileRedirectUris(List.of("margins://oauth/google"));
        AuthJwtProperties jwt = new AuthJwtProperties();
        jwt.setRefreshTtlSeconds(604800);
        clientIpResolver = mock(ClientIpResolver.class);
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        controller = new MobileGoogleOAuthController(
            google, properties, stateService, authService, privacy, jwt, clientIpResolver, environment);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void startUsesServerOwnedStateNonceAndPkceForAnAllowlistedRedirect() throws Exception {
        when(google.buildNativeAuthorizationUrl(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString()
        )).thenReturn("https://accounts.google.test/authorize");

        MockHttpServletResponse response = new MockHttpServletResponse();
        controller.start("margins://oauth/google", challenge(VERIFIER), response);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://accounts.google.test/authorize");
        verify(google).requireEnabled();
    }

    @Test
    void startRejectsNonAllowlistedAppLinksBeforeRedirecting() {
        assertThatThrownBy(() -> controller.start(
            "evil://oauth", challenge(VERIFIER), new MockHttpServletResponse()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("AUTH_GOOGLE_OAUTH_REQUEST_INVALID");
    }

    @Test
    void productionRejectsCustomSchemesEvenWhenTheyAreAllowlisted() {
        MockEnvironment production = new MockEnvironment();
        AuthJwtProperties jwt = new AuthJwtProperties();
        MobileGoogleOAuthController productionController = new MobileGoogleOAuthController(
            google, properties, stateService, authService, privacy, jwt, clientIpResolver, production);

        assertThatThrownBy(() -> productionController.start(
            "margins://oauth/google", challenge(VERIFIER), new MockHttpServletResponse()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("AUTH_GOOGLE_OAUTH_REQUEST_INVALID");
    }

    @Test
    void productionAcceptsOnlyAnExplicitlyAllowlistedHttpsAppLink() throws Exception {
        properties.setMobileRedirectUris(List.of("https://margins.cloud/oauth/google"));
        when(google.buildNativeAuthorizationUrl(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString()
        )).thenReturn("https://accounts.google.test/authorize");
        MockEnvironment production = new MockEnvironment();
        AuthJwtProperties jwt = new AuthJwtProperties();
        MobileGoogleOAuthController productionController = new MobileGoogleOAuthController(
            google, properties, stateService, authService, privacy, jwt, clientIpResolver, production);

        MockHttpServletResponse response = new MockHttpServletResponse();
        productionController.start(
            "https://margins.cloud/oauth/google", challenge(VERIFIER), response);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://accounts.google.test/authorize");
    }

    @Test
    void callbackRedirectsWithOnlyOneTimeExchangeCodeAndExchangeCannotReplay() throws Exception {
        var authorization = stateService.begin("margins://oauth/google", challenge(VERIFIER));
        // The verifier is intentionally server-only, so match it rather than exposing it through the test URL.
        when(google.exchangeNativeAuthorizationCode(
            org.mockito.ArgumentMatchers.eq("provider-code"),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(authorization.nonce())
        )).thenReturn(new GoogleUserProfile("subject", "reader@example.com", true, "Reader"));
        when(authService.hasGoogleIdentity("subject")).thenReturn(true);
        when(authService.loginGoogleUser("subject", "reader@example.com", true, "Reader"))
            .thenReturn(session());

        MockHttpServletResponse response = new MockHttpServletResponse();
        controller.callback("provider-code", authorization.state(), null, response);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).startsWith("margins://oauth/google?code=");
        assertThat(redirect).doesNotContain("reader@example.com", "access-token", "refresh-token");
        String exchangeCode = redirect.substring(redirect.indexOf("code=") + 5);
        verifyNoInteractions(authService);

        assertThatThrownBy(() -> controller.exchange(NativeGoogleOAuthExchangeRequest.builder()
            .code(exchangeCode)
            .build()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("AUTH_GOOGLE_OAUTH_REQUEST_INVALID");
        assertThatThrownBy(() -> controller.exchange(NativeGoogleOAuthExchangeRequest.builder()
            .code(exchangeCode)
            .verifier("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefg")
            .build()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("AUTH_GOOGLE_OAUTH_REQUEST_INVALID");
        verifyNoInteractions(authService);

        mockMvc.perform(post("/api/mobile/auth/oauth/google/exchange")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exchangeJson(exchangeCode)))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
            .andExpect(jsonPath("$.data.status").value("SESSION"))
            .andExpect(jsonPath("$.data.session.refreshToken").value("refresh-token"));

        assertThatThrownBy(() -> controller.exchange(exchangeRequest(exchangeCode)))
            .isInstanceOf(ApiException.class);
    }

    @Test
    void newGoogleIdentityExchangesForTypedPendingRegistration() throws Exception {
        var authorization = stateService.begin("margins://oauth/google", challenge(VERIFIER));
        when(google.exchangeNativeAuthorizationCode(
            org.mockito.ArgumentMatchers.eq("provider-code"),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(authorization.nonce())
        )).thenReturn(new GoogleUserProfile("new-subject", "new@example.com", true, "New Reader"));
        when(authService.hasGoogleIdentity("new-subject")).thenReturn(false);
        when(privacy.createGoogleRegistration("new-subject", "new@example.com", true, "New Reader"))
            .thenReturn("pending-registration");

        MockHttpServletResponse response = new MockHttpServletResponse();
        controller.callback("provider-code", authorization.state(), null, response);
        String exchangeCode = response.getRedirectedUrl().split("code=", 2)[1];
        mockMvc.perform(post("/api/mobile/auth/oauth/google/exchange")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exchangeJson(exchangeCode)))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
            .andExpect(jsonPath("$.data.status").value("REGISTRATION_REQUIRED"))
            .andExpect(jsonPath("$.data.pendingRegistrationToken").value("pending-registration"))
            .andExpect(jsonPath("$.data.session").doesNotExist());
    }

    @Test
    void registrationSessionIsNeverCacheable() throws Exception {
        when(authService.completeGoogleRegistration(
            org.mockito.ArgumentMatchers.eq("pending-registration"),
            org.mockito.ArgumentMatchers.any()
        )).thenReturn(session());

        mockMvc.perform(post("/api/mobile/auth/oauth/google/registrations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "pendingRegistrationToken": "pending-registration",
                      "privacyPolicyAccepted": true,
                      "aiTransferAccepted": true,
                      "ageOver14Confirmed": true,
                      "privacyPolicyVersion": "2026-01-01",
                      "aiTransferVersion": "2026-01-01",
                      "preferredLocale": "en"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
            .andExpect(jsonPath("$.data.refreshToken").value("refresh-token"));
    }

    private AuthSession session() {
        return new AuthSession(LoginResponse.builder()
            .userId(1L)
            .username("reader")
            .displayName("Reader")
            .accessToken("access-token")
            .accessTokenExpiresInSeconds(900)
            .preferredLocale("en")
            .authMode("google-oauth-jwt")
            .membershipTier("FREE")
            .build(), "refresh-token");
    }

    private NativeGoogleOAuthExchangeRequest exchangeRequest(String code) {
        return NativeGoogleOAuthExchangeRequest.builder().code(code).verifier(VERIFIER).build();
    }

    private String exchangeJson(String code) {
        return "{\"code\":\"%s\",\"verifier\":\"%s\"}".formatted(code, VERIFIER);
    }

    private static String challenge(String verifier) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(
                    verifier.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
