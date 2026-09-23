package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.business.AuthBusiness.AuthSession;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.SecurityConfig;
import com.margins.auth.controller.MobileAuthController;
import com.margins.auth.dto.LoginRequest;
import com.margins.auth.dto.LoginResponse;
import com.margins.auth.dto.EmailAvailabilityResponse;
import com.margins.auth.dto.RegisterRequest;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.service.AuthService;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.service.PrivacyConsentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(
    controllers = MobileAuthController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class}
    )
)
class MobileAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    private AuthJwtProperties authJwtProperties;

    @MockBean
    private PrivacyConsentService privacyConsentService;

    @BeforeEach
    void setUp() {
        when(authJwtProperties.getRefreshTtlSeconds()).thenReturn(604800L);
    }

    @Test
    void registrationIntentReturnsTokenInBodyWithoutCookie() throws Exception {
        when(privacyConsentService.createRegistrationIntent(any())).thenReturn("registration-intent");

        mockMvc.perform(post("/api/mobile/auth/registration-intents")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "privacyPolicyAccepted": true,
                      "aiTransferAccepted": true,
                      "ageOver14Confirmed": true,
                      "privacyPolicyVersion": "2026-01-01",
                      "aiTransferVersion": "2026-01-01",
                      "preferredLocale": "ko"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))
            .andExpect(jsonPath("$.data.registrationIntentToken").value("registration-intent"));

        verify(privacyConsentService).createRegistrationIntent(any(ConsentRequest.class));
    }

    @Test
    void emailAvailabilityAcceptsOnlyAJsonBodySoTheAddressIsAbsentFromTheUrl() throws Exception {
        when(authService.checkEmailAvailability("reader@example.com"))
            .thenReturn(EmailAvailabilityResponse.builder()
                .email("reader@example.com")
                .available(true)
                .build());

        mockMvc.perform(post("/api/mobile/auth/email-availability")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"reader@example.com\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.available").value(true));

        verify(authService).checkEmailAvailability("reader@example.com");
    }

    @Test
    void loginReturnsNativeSessionWithoutCookie() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(session("refresh-token"));

        mockMvc.perform(post("/api/mobile/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"peacepiece\",\"password\":\"reader\"}"))
            .andExpect(status().isOk())
            .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
            .andExpect(jsonPath("$.data.accessToken").value("access-token"))
            .andExpect(jsonPath("$.data.refreshToken").value("refresh-token"))
            .andExpect(jsonPath("$.data.refreshTokenExpiresInSeconds").value(604800));
    }

    @Test
    void registerMapsExistingFieldsAndExplicitIntentToAuthService() throws Exception {
        when(authService.register(any(RegisterRequest.class), eq("registration-intent")))
            .thenReturn(session("registered-refresh-token"));

        mockMvc.perform(post("/api/mobile/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRegistrationJson("registration-intent")))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
            .andExpect(jsonPath("$.data.username").value("reader"))
            .andExpect(jsonPath("$.data.refreshToken").value("registered-refresh-token"));

        ArgumentCaptor<RegisterRequest> requestCaptor = ArgumentCaptor.forClass(RegisterRequest.class);
        verify(authService).register(requestCaptor.capture(), eq("registration-intent"));
        RegisterRequest mapped = requestCaptor.getValue();
        assertThat(mapped.getUsername()).isEqualTo("reader");
        assertThat(mapped.getDisplayName()).isEqualTo("Reader");
        assertThat(mapped.getEmail()).isEqualTo("reader@example.com");
        assertThat(mapped.getEmailVerificationCode()).isEqualTo("123456");
        assertThat(mapped.getPreferredLocale()).isEqualTo("ko");
    }

    @Test
    void registerRejectsMissingIntentBeforeBusinessLogic() throws Exception {
        mockMvc.perform(post("/api/mobile/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRegistrationJson("")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields[0].field").value("registrationIntentToken"));

        verifyNoInteractions(authService);
    }

    @Test
    void refreshRequiresTokenAndReturnsRotatedNativeSession() throws Exception {
        mockMvc.perform(post("/api/mobile/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"));

        when(authService.refresh("old-refresh-token")).thenReturn(session("new-refresh-token"));
        mockMvc.perform(post("/api/mobile/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"old-refresh-token\"}"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
            .andExpect(jsonPath("$.data.refreshToken").value("new-refresh-token"));

        verify(authService).refresh("old-refresh-token");
    }

    @Test
    void logoutRevokesBodyTokenWithoutAccessPrincipal() throws Exception {
        mockMvc.perform(post("/api/mobile/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"refresh-token\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(authService).logout("refresh-token", null);
    }

    @Test
    void logoutRejectsMissingRefreshToken() throws Exception {
        mockMvc.perform(post("/api/mobile/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"));

        verifyNoInteractions(authService);
    }

    private AuthSession session(String refreshToken) {
        return new AuthSession(LoginResponse.builder()
            .userId(1L)
            .username("reader")
            .displayName("Reader")
            .authMode("local-jwt")
            .accessToken("access-token")
            .accessTokenExpiresInSeconds(900L)
            .consentRequired(false)
            .membershipTier("FREE")
            .preferredLocale("ko")
            .build(), refreshToken);
    }

    private String validRegistrationJson(String registrationIntentToken) {
        return """
            {
              "registrationIntentToken": "%s",
              "username": "reader",
              "password": "long-enough-password",
              "confirmPassword": "long-enough-password",
              "displayName": "Reader",
              "email": "reader@example.com",
              "emailVerificationCode": "123456",
              "preferredLocale": "ko"
            }
            """.formatted(registrationIntentToken);
    }
}
