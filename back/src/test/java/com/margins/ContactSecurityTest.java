package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.mapper.UserMapper;
import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.support.ClientIpResolver;
import com.margins.contact.controller.ContactController;
import com.margins.contact.dto.ContactInquiryResponse;
import com.margins.contact.service.ContactService;
import com.margins.privacy.service.PrivacyConsentService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = ContactController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class ContactSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockBean ContactService contactService;
    @MockBean ClientIpResolver clientIpResolver;
    @MockBean JwtTokenService jwtTokenService;
    @MockBean UserMapper userMapper;
    @MockBean PrivacyConsentService privacyConsentService;

    @Test
    void anonymousVisitorCanSubmitContactInquiry() throws Exception {
        when(clientIpResolver.resolve(any())).thenReturn("203.0.113.4");
        when(contactService.submit(any(), any())).thenReturn(
            new ContactInquiryResponse(1L, "OPEN", Instant.parse("2026-08-24T00:00:00Z")));

        mockMvc.perform(post("/api/contact-inquiries")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"reader@example.com","category":"OTHER","subject":"Question",
                     "message":"Please help.","botChallengeToken":"challenge"}
                    """))
            .andExpect(status().isCreated());
    }

    @Test
    void anonymousVisitorCannotAccessOtherMethodsAtContactPath() throws Exception {
        mockMvc.perform(get("/api/contact-inquiries"))
            .andExpect(status().isUnauthorized());
    }
}
