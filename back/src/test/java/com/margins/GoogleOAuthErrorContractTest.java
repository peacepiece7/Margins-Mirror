package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.config.AuthCookieProperties;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.config.SecurityConfig;
import com.margins.auth.controller.GoogleOAuthController;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.service.AuthService;
import com.margins.auth.service.GoogleOAuthService;
import com.margins.auth.support.AuthCookieSupport;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.service.PrivacyConsentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(
    controllers = GoogleOAuthController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class}
    )
)
class GoogleOAuthErrorContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GoogleOAuthService googleOAuthService;

    @MockBean
    private GoogleAuthProperties googleAuthProperties;

    @MockBean
    private AuthService authService;

    @MockBean
    private AuthCookieSupport authCookieSupport;

    @MockBean
    private AuthCookieProperties authCookieProperties;

    @MockBean
    private AuthJwtProperties authJwtProperties;

    @MockBean
    private PrivacyConsentService privacyConsentService;

    @Test
    void existingEmailReturnsStableCodeWithoutBackendReason() throws Exception {
        when(authCookieSupport.readCookieValue(any(), any())).thenReturn("pending-token");
        doThrow(new ApiException(
            ApiErrorCode.AUTH_GOOGLE_LINK_REQUIRED,
            "manual google account linking required"
        )).when(authService).completeGoogleRegistration(any(), any());

        mockMvc.perform(post("/api/auth/oauth/google/registrations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "privacyPolicyAccepted": true,
                      "aiTransferAccepted": true,
                      "ageOver14Confirmed": true,
                      "privacyPolicyVersion": "2026-07-27",
                      "aiTransferVersion": "2026-07-27"
                    }
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("AUTH_GOOGLE_LINK_REQUIRED"))
            .andExpect(jsonPath("$.error.requestId").isNotEmpty())
            .andExpect(jsonPath("$.message").doesNotExist())
            .andExpect(content().string(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("manual google account linking required")
            )));
    }
}
