package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.controller.AuthController;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(
    controllers = AuthController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = {SecurityConfig.class, JwtAuthenticationFilter.class})
)
class AuthControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    private com.margins.auth.support.AuthCookieSupport authCookieSupport;

    @MockBean
    private com.margins.auth.config.AuthCookieProperties authCookieProperties;

    @MockBean
    private com.margins.auth.config.AuthJwtProperties authJwtProperties;

    @MockBean
    private com.margins.privacy.service.PrivacyConsentService privacyConsentService;

    @MockBean
    private com.margins.auth.support.ClientIpResolver clientIpResolver;

    @Test
    void loginRejectsBlankUsername() throws Exception {
        mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"\",\"password\":\"reader\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields[0].field").value("username"))
            .andExpect(jsonPath("$.message").doesNotExist());

        verifyNoInteractions(authService);
    }

    @Test
    void loginRejectsBlankPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"peacepiece\",\"password\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(authService);
    }

    @Test
    void emailVerificationCanStartWithoutRegistrationConsentIntent() throws Exception {
        when(clientIpResolver.resolve(any())).thenReturn("127.0.0.1");
        when(authService.issueEmailVerificationCode(
            "reader@example.com", "challenge-token", "127.0.0.1"
        )).thenReturn(EmailVerificationResponse.builder()
            .email("reader@example.com")
            .expiresInSeconds(300)
            .resendAfterSeconds(60)
            .build());

        mockMvc.perform(post("/api/auth/email-verifications")
                .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "email": "reader@example.com",
                  "botChallengeToken": "challenge-token"
                }
                """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.email").value("reader@example.com"))
            .andExpect(jsonPath("$.data.resendAfterSeconds").value(60));

        verify(authService).issueEmailVerificationCode(
            "reader@example.com", "challenge-token", "127.0.0.1");
        verifyNoInteractions(privacyConsentService);
    }
}
