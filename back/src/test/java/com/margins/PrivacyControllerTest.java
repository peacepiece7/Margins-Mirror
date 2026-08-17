package com.margins;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.config.SecurityConfig;
import com.margins.privacy.controller.PrivacyController;
import com.margins.privacy.dto.PrivacyConsentStatusResponse;
import com.margins.privacy.dto.PrivacyRequirementsResponse;
import com.margins.privacy.service.PrivacyConsentService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
    controllers = PrivacyController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class}
    )
)
class PrivacyControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean PrivacyConsentService privacyConsentService;

    @Test
    void publishesCurrentPublicRequirements() throws Exception {
        when(privacyConsentService.requirements()).thenReturn(PrivacyRequirementsResponse.builder()
            .privacyPolicyVersion("2026-07-27")
            .aiTransferVersion("2026-07-27")
            .effectiveDate(LocalDate.of(2026, 7, 27))
            .privacyUrl("/privacy")
            .historyUrl("/privacy/history")
            .minimumAge(14)
            .build());

        mockMvc.perform(get("/api/privacy/requirements"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.privacyPolicyVersion").value("2026-07-27"))
            .andExpect(jsonPath("$.data.minimumAge").value(14));
    }

    @Test
    void grantsAllCurrentConsentsForAuthenticatedPendingUser() throws Exception {
        var completed = PrivacyConsentStatusResponse.builder()
            .acceptedVersions(Map.of(
                "PRIVACY_POLICY", "2026-07-27",
                "OPENAI_OVERSEAS_TRANSFER", "2026-07-27",
                "AGE_OVER_14", "2026-07-27"
            ))
            .missingConsentTypes(List.of())
            .consentRequired(false)
            .build();
        when(privacyConsentService.status(7L)).thenReturn(completed);

        mockMvc.perform(post("/api/privacy/consents")
                .requestAttr(JwtAuthenticationFilter.USER_ID_ATTRIBUTE, 7L)
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
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.consentRequired").value(false));

        verify(privacyConsentService).grant(
            org.mockito.ArgumentMatchers.eq(7L),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.eq("EXISTING"),
            org.mockito.ArgumentMatchers.eq(false)
        );
    }
}
