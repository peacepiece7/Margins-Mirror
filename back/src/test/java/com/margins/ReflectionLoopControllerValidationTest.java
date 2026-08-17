package com.margins;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.controller.ReflectionLoopController;
import com.margins.reflectionloop.service.ReflectionLoopService;
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
    controllers = ReflectionLoopController.class
)
class ReflectionLoopControllerValidationTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ReflectionLoopService reflectionLoopService;

    @Test
    void reflectionRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/reading-sessions/1/reflections")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"  \",\"visibility\":\"PRIVATE\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void interviewRejectsUnknownResponseMode() throws Exception {
        mockMvc.perform(post("/api/reflection-interviews/2/responses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"questionId\":3,\"mode\":\"LATER\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void interviewAnswerRevisionRejectsInvalidVersionAndKind() throws Exception {
        mockMvc.perform(put("/api/reflection-interviews/2/answers/3")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedAnswerVersion\":0,\"content\":\"수정\",\"revisionKind\":\"REWRITE\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void guideRejectsMissingOrUnsupportedBrief() throws Exception {
        mockMvc.perform(post("/api/reflection-interviews/2/guides")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "purpose": "THOUGHT_EXPANSION",
                      "facilitationLevel": "BEGINNER",
                      "audienceMode": "SELF_AI",
                      "targetMinutes": 30,
                      "disclosureMode": "PRIVATE_CONTEXT"
                    }
                    """))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/reflection-interviews/2/guides")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void guideUpstreamFailureUsesTypedSafeEnvelope() throws Exception {
        when(reflectionLoopService.createGuide(
            org.mockito.ArgumentMatchers.eq(2L),
            org.mockito.ArgumentMatchers.any()
        )).thenThrow(new ApiException(
            ApiErrorCode.COMMON_UPSTREAM_ERROR,
            "provider max output detail must stay private"
        ));

        mockMvc.perform(post("/api/reflection-interviews/2/guides")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "purpose": "THOUGHT_EXPANSION",
                      "audienceMode": "SELF_AI",
                      "targetMinutes": 40,
                      "disclosureMode": "PRIVATE_CONTEXT"
                    }
                    """))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_UPSTREAM_ERROR"))
            .andExpect(jsonPath("$.error.requestId").isNotEmpty())
            .andExpect(jsonPath("$.error.message").doesNotExist());

        verify(reflectionLoopService).createGuide(
            org.mockito.ArgumentMatchers.eq(2L),
            org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void guideEditRejectsIncompleteVersionContent() throws Exception {
        mockMvc.perform(post("/api/discussion-guides/3/versions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "expectedVersion": 1,
                      "goal": "목표",
                      "issues": ["하나"],
                      "items": []
                    }
                    """))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void guideRegenerateRequiresVersionAndBrief() throws Exception {
        mockMvc.perform(post("/api/discussion-guides/3/regenerate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void guideProjectionDelegatesAndMarkdownRequiresProjection() throws Exception {
        mockMvc.perform(get("/api/discussion-guides/3/projections/PARTICIPANT"))
            .andExpect(status().isOk());

        verify(reflectionLoopService).guideProjection(3L, "PARTICIPANT");

        mockMvc.perform(get("/api/discussion-guides/3/exports/markdown"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void discussionTurnRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/discussion-runs/4/turns")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\",\"navigation\":\"RESPOND\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }

    @Test
    void refinementRejectsUnknownOutcome() throws Exception {
        mockMvc.perform(post("/api/discussion-runs/4/refinement")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"EDITED\",\"outcome\":\"BETTER\",\"finalContent\":\"text\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(reflectionLoopService);
    }
}
