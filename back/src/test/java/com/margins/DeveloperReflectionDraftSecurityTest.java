package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.config.SecurityConfig;
import com.margins.auth.dto.AuthPrincipal;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.support.AuthContext;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftController;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftResponse;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftService;
import com.margins.testsupport.TestAuthSupport;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Exercises the developer draft HTTP authentication boundary with real security filters. */
@WebMvcTest(controllers = DeveloperReflectionDraftController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class DeveloperReflectionDraftSecurityTest {
    @Autowired private MockMvc mockMvc;
    @MockBean private DeveloperReflectionDraftService service;
    @MockBean private JwtTokenService jwtTokenService;
    @MockBean private UserMapper userMapper;
    @MockBean private PrivacyConsentService privacyConsentService;

    @Test
    void anonymousAndInvalidBearerRequestsCannotInvokeGeneration() throws Exception {
        when(jwtTokenService.validate("invalid-token")).thenReturn(Optional.empty());
        for (String authorization : List.of("", "Bearer invalid-token")) {
            mockMvc.perform(post("/api/developer/reflection-drafts")
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"target\":\"PRIMARY_REFLECTION\",\"bookId\":7}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("COMMON_UNAUTHORIZED"));
        }
        verifyNoInteractions(service);
    }

    @Test
    void validBearerRequestReachesGenerationWithAuthenticatedOwner() throws Exception {
        when(jwtTokenService.validate("valid-token")).thenReturn(Optional.of(AuthPrincipal.builder()
            .userId(1L).username("peacepiece").displayName("reader")
            .authProvider("local").credentialsVersion(1L).build()));
        when(userMapper.findById(1L)).thenReturn(Optional.of(TestAuthSupport.peacepieceUser()));
        when(privacyConsentService.hasCurrentRequiredConsents(1L)).thenReturn(true);
        when(service.generate(any())).thenAnswer(invocation -> {
            assertThat(AuthContext.requireUserId()).isEqualTo(1L);
            return DeveloperReflectionDraftResponse.builder()
                .content("draft").model("gpt-6-luna").personas(List.of()).build();
        });

        mockMvc.perform(post("/api/developer/reflection-drafts")
                .header(HttpHeaders.AUTHORIZATION, "Bearer valid-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"target\":\"PRIMARY_REFLECTION\",\"bookId\":7}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").value("draft"));
    }
}
