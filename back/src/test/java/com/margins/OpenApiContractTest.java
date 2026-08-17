package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.mapper.RefreshTokenMapper;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.model.UserRecord;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.testsupport.TestAuthSupport;
import com.margins.membership.model.MembershipTier;
import com.margins.membership.service.MembershipService;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class OpenApiContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserMapper userMapper;

    @MockBean
    private RefreshTokenMapper refreshTokenMapper;

    @MockBean
    private MembershipService membershipService;

    @MockBean
    private PrivacyConsentService privacyConsentService;

    @BeforeEach
    void stubAuthPersistence() {
        UserRecord user = TestAuthSupport.demo_readerUser();
        when(userMapper.findByUsername(TestAuthSupport.TEST_USERNAME)).thenReturn(Optional.of(user));
        when(userMapper.findByUsername(anyString())).thenAnswer(invocation -> {
            if (TestAuthSupport.TEST_USERNAME.equals(invocation.getArgument(0))) {
                return Optional.of(user);
            }
            return Optional.empty();
        });
        when(userMapper.findById(1L)).thenReturn(Optional.of(user));
        when(userMapper.resetLoginSuccess(anyLong())).thenReturn(1);
        when(refreshTokenMapper.insert(any())).thenReturn(1);
        when(membershipService.tierFor(1L)).thenReturn(MembershipTier.FREE);
        when(privacyConsentService.isConsentRequiredForSession(1L)).thenReturn(false);
        when(privacyConsentService.hasCurrentRequiredConsents(1L)).thenReturn(true);
    }

    @Test
    void openApiSpecIsPublicAndListsMvpRoutes() throws Exception {
        String body = mockMvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        JsonNode root = objectMapper.readTree(body);
        JsonNode paths = root.path("paths");

        assertThat(root.path("info").path("title").asText()).isEqualTo("Margins API");
        assertThat(paths.has("/api/auth/login")).isTrue();
        assertThat(paths.has("/api/reading-sessions")).isTrue();
        assertThat(paths.has("/api/reading-sessions/public-reviews")).isTrue();
        assertThat(paths.has("/api/reading-sessions/public-reviews/{insightId}/comments")).isTrue();
        assertThat(paths.has("/api/reading-sessions/public-reviews/{insightId}/comments/{commentId}")).isTrue();
        assertThat(paths.path("/api/reading-sessions/public-reviews/{insightId}/comments/{commentId}").has("patch")).isTrue();
        assertThat(paths.path("/api/reading-sessions/public-reviews/{insightId}/comments/{commentId}").has("delete")).isTrue();
        assertThat(paths.has("/api/reading-sessions/{id}/metrics/snapshot")).isTrue();
        assertThat(paths.has("/api/session-windows/{id}/messages/stream")).isTrue();
        assertThat(paths.has("/api/personas")).isTrue();
        assertThat(paths.has("/api/personas/recommendations")).isTrue();
        assertThat(paths.path("/api/memory-cards/{cardId}/memorized").has("patch")).isTrue();
        assertThat(paths.has("/api/shell-crawler/saves/default")).isFalse();
        assertThat(paths.path("/api/session-windows/{id}/debate").path("post").path("requestBody").toString())
            .contains("DebateMessageRequest");
        assertThat(paths.path("/api/session-windows/{id}/debate/all").path("post").path("requestBody").toString())
            .contains("DebateAllMessageRequest")
            .doesNotContain("DebateMessageRequest");
        JsonNode schemas = root.path("components").path("schemas");
        assertThat(schemas.path("SendMessageRequest").toString())
            .doesNotContain("contextMessageId");
        assertThat(schemas.path("DebateMessageRequest").toString())
            .doesNotContain("contextMessageId");
        assertReflectionLoopSchemas(paths, schemas);
        JsonNode apiErrorSchema = schemas.path("ApiError");
        assertThat(apiErrorSchema.path("properties").has("code")).isTrue();
        assertThat(apiErrorSchema.path("properties").has("fields")).isTrue();
        assertThat(apiErrorSchema.path("properties").has("requestId")).isTrue();
        root.path("components").path("schemas").fields().forEachRemaining(schema -> {
            if (schema.getKey().startsWith("ApiResponse")) {
                assertThat(schema.getValue().path("properties").has("message")).isFalse();
            }
        });
    }

    @Test
    void protectedApiRejectsAnonymousRequestsInFullContext() throws Exception {
        mockMvc.perform(get("/api/reading-sessions/latest"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_UNAUTHORIZED"))
            .andExpect(jsonPath("$.message").doesNotExist());

        mockMvc.perform(get("/api/books"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_UNAUTHORIZED"));

    }

    @Test
    void validationFailuresUseApiResponseInFullContext() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"\",\"password\":\"reader\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields[0].field").value("username"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void loginIssuedTokenPassesFullContextAuthFilter() throws Exception {
        String loginBody = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"demo_reader\",\"password\":\"reader\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        String accessToken = objectMapper.readTree(loginBody).path("data").path("accessToken").asText();

        assertThat(accessToken).isNotBlank();

        mockMvc.perform(get("/api/protected-contract-probe")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
            .andExpect(status().isNotFound());
    }

    @Test
    void loginRejectsInvalidCredentials() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"wrong-user\",\"password\":\"reader\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("AUTH_INVALID_CREDENTIALS"))
            .andExpect(jsonPath("$.message").doesNotExist());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"demo_reader\",\"password\":\"wrong-password\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("AUTH_INVALID_CREDENTIALS"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    private void assertReflectionLoopSchemas(JsonNode paths, JsonNode schemas) {
        assertThat(paths.path("/api/reading-sessions/{sessionId}/reflections")
            .path("post").path("requestBody").toString())
            .contains("SaveReflectionRequest");
        assertThat(paths.path("/api/reflection-interviews/{interviewId}/guides")
            .path("post").path("requestBody").toString())
            .contains("GuideBriefRequest");
        assertThat(paths.path("/api/reflection-interviews/{interviewId}/answers/{questionId}")
            .path("put").path("requestBody").toString())
            .contains("UpdateInterviewAnswerRequest");
        assertThat(paths.path("/api/discussion-runs/{runId}/turns")
            .path("post").path("requestBody").toString())
            .contains("GuidedDiscussionTurnRequest");

        assertThat(propertyNames(schemas.path("SaveReflectionRequest")))
            .containsExactlyInAnyOrder(
                "content",
                "title",
                "evidence",
                "authorName",
                "visibility",
                "reviewedOn"
            );
        assertThat(schemas.path("SaveReflectionRequest")
            .path("properties").path("visibility").path("pattern").asText())
            .isEqualTo("PRIVATE|PUBLIC");
        assertThat(propertyNames(schemas.path("GuideBriefRequest")))
            .contains(
                "purpose",
                "facilitationLevel",
                "audienceMode",
                "targetMinutes",
                "disclosureMode"
            );
        assertThat(schemas.path("GuideBriefRequest")
            .path("properties").path("purpose").path("pattern").asText())
            .isEqualTo("THOUGHT_EXPANSION|ISSUE_EXPLORATION|DISCUSSION_PREP");
        assertThat(schemas.path("GuideBriefRequest")
            .path("properties").path("facilitationLevel").path("pattern").asText())
            .isEqualTo("BEGINNER|EXPERIENCED|EXPERT");
        assertThat(schemas.path("GuideBriefRequest").path("required").toString())
            .doesNotContain("facilitationLevel");
        assertThat(propertyNames(schemas.path("UpdateInterviewAnswerRequest")))
            .containsExactlyInAnyOrder("expectedAnswerVersion", "content", "revisionKind");
        assertThat(schemas.path("UpdateInterviewAnswerRequest")
            .path("properties").path("revisionKind").path("pattern").asText())
            .isEqualTo("WORDING_ONLY|RESTART_FROM_HERE");
        assertThat(schemas.path("DiscussionGuideMarkdownExportResponse")
            .path("properties").path("projection").path("enum").toString())
            .isEqualTo("[\"FACILITATOR\",\"PARTICIPANT\"]");
        assertThat(propertyNames(schemas.path("ReflectionLoopResponse")))
            .containsExactlyInAnyOrder(
                "reflectionId",
                "sessionId",
                "visibility",
                "currentRevision",
                "revisions",
                "activeInterviewId",
                "guideId",
                "runId",
                "runStatus"
            );
    }

    private List<String> propertyNames(JsonNode schema) {
        List<String> names = new ArrayList<>();
        schema.path("properties").fieldNames().forEachRemaining(names::add);
        return names;
    }
}
