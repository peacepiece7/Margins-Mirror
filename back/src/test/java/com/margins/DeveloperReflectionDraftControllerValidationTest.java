package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftController;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftResponse;
import com.margins.reflectionloop.developer.DeveloperReflectionDraftService;
import java.util.List;
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
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class}
    ),
    controllers = DeveloperReflectionDraftController.class
)
class DeveloperReflectionDraftControllerValidationTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeveloperReflectionDraftService service;

    @Test
    void validRequestDelegatesAndReturnsTheTypedResponse() throws Exception {
        when(service.generate(any())).thenReturn(DeveloperReflectionDraftResponse.builder()
            .content("draft")
            .model("gpt-6-luna")
            .personas(List.of())
            .build());

        mockMvc.perform(post("/api/developer/reflection-drafts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"target":"PRIMARY_REFLECTION","bookId":7,"subject":"topic"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").value("draft"))
            .andExpect(jsonPath("$.data.model").value("gpt-6-luna"));

        verify(service).generate(any());
    }

    @Test
    void rejectsUnknownTargetInvalidBookAndOversizedContext() throws Exception {
        mockMvc.perform(post("/api/developer/reflection-drafts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" +
                    "\"target\":\"UNKNOWN\"," +
                    "\"bookId\":0," +
                    "\"context\":\"" + "x".repeat(8001) + "\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void providerFailureUsesTheSafeUpstreamEnvelope() throws Exception {
        when(service.generate(any())).thenThrow(new ApiException(
            ApiErrorCode.COMMON_UPSTREAM_ERROR,
            "private provider detail"
        ));

        mockMvc.perform(post("/api/developer/reflection-drafts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" +
                    "\"target\":\"DISCUSSION_TURN\"," +
                    "\"bookId\":7}"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.error.code").value("COMMON_UPSTREAM_ERROR"))
            .andExpect(jsonPath("$.error.message").doesNotExist());
    }
}
