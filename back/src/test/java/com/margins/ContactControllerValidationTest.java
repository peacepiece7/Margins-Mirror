package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.support.ClientIpResolver;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.contact.controller.ContactController;
import com.margins.contact.dto.ContactInquiryResponse;
import com.margins.contact.service.ContactService;
import java.time.Instant;
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
    controllers = ContactController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class})
)
class ContactControllerValidationTest {
    @Autowired MockMvc mockMvc;
    @MockBean ContactService contactService;
    @MockBean ClientIpResolver clientIpResolver;

    @Test
    void acceptsBoundedRequestAndReturnsCreatedContract() throws Exception {
        Instant createdAt = Instant.parse("2026-08-24T00:00:00Z");
        when(clientIpResolver.resolve(any())).thenReturn("203.0.113.4");
        when(contactService.submit(any(), any())).thenReturn(
            new ContactInquiryResponse(42L, "OPEN", createdAt));

        mockMvc.perform(post("/api/contact-inquiries")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.inquiryId").value(42))
            .andExpect(jsonPath("$.data.status").value("OPEN"))
            .andExpect(jsonPath("$.data.createdAt").value("2026-08-24T00:00:00Z"));
    }

    @Test
    void rejectsUnknownCategoryAndControlCharacters() throws Exception {
        for (String body : new String[] {
            validBody().replace("SERVICE_USAGE", "BILLING"),
            validBody().replace("Need help", "Need\\u0001help"),
            validBody().replace("Need help", "Need\\nhelp")
        }) {
            mockMvc.perform(post("/api/contact-inquiries")
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"));
        }
        verifyNoInteractions(contactService);
    }

    @Test
    void mapsMissingChallengeToDedicatedPublicCode() throws Exception {
        when(clientIpResolver.resolve(any())).thenReturn("203.0.113.4");
        when(contactService.submit(any(), any())).thenThrow(
            new ApiException(ApiErrorCode.CONTACT_INQUIRY_BOT_CHALLENGE_INVALID));

        mockMvc.perform(post("/api/contact-inquiries")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody().replace("challenge-token", "")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("CONTACT_INQUIRY_BOT_CHALLENGE_INVALID"));

        verify(contactService).submit(any(), any());
    }

    private String validBody() {
        return """
            {"email":"reader@example.com","category":"SERVICE_USAGE","subject":"Need help",
             "message":"Please help with the library.","botChallengeToken":"challenge-token"}
            """;
    }
}
