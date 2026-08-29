package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.mapper.RefreshTokenMapper;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.model.UserRecord;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.service.SessionWindowService;
import com.margins.testsupport.TestAuthSupport;
import com.margins.membership.model.MembershipTier;
import com.margins.membership.service.MembershipService;
import com.margins.privacy.service.PrivacyConsentService;
import java.util.Optional;
import java.util.function.Consumer;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class SessionStreamSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SessionWindowService sessionWindowService;

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
        UserRecord user = TestAuthSupport.peacepieceUser();
        when(userMapper.findByUsername(TestAuthSupport.TEST_USERNAME)).thenReturn(Optional.of(user));
        when(userMapper.findById(1L)).thenReturn(Optional.of(user));
        when(userMapper.resetLoginSuccess(anyLong())).thenReturn(1);
        when(refreshTokenMapper.insert(any())).thenReturn(1);
        when(membershipService.tierFor(1L)).thenReturn(MembershipTier.FREE);
        when(privacyConsentService.isConsentRequiredForSession(1L)).thenReturn(false);
        when(privacyConsentService.hasCurrentRequiredConsents(1L)).thenReturn(true);
    }

    @Test
    void streamedMessageCompletesAsyncDispatchWithJwtAuth() throws Exception {
        doAnswer((invocation) -> {
            Consumer<String> deltaConsumer = invocation.getArgument(2);
            deltaConsumer.accept("Provider ");
            deltaConsumer.accept("streamed text");
            return AiMessageResponse.builder()
                .messageId(77L)
                .windowId(1L)
                .role("assistant")
                .content("Provider streamed text")
                .streamingReady(true)
                .aiModel("placeholder")
                .build();
        }).when(sessionWindowService).streamMessage(eq(1L), any(SendMessageRequest.class), any());

        String loginBody = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"peacepiece\",\"password\":\"reader\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        String accessToken = objectMapper.readTree(loginBody).path("data").path("accessToken").asText();

        MvcResult streamingResult = mockMvc.perform(post("/api/session-windows/1/messages/stream")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"hello\",\"questionId\":5,\"clientCorrelationId\":\"client-1\"}"))
            .andExpect(request().asyncStarted())
            .andReturn();

        MvcResult dispatchedResult = mockMvc.perform(asyncDispatch(streamingResult))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andReturn();
        String stream = dispatchedResult.getResponse().getContentAsString();

        assertThat(stream).contains(
            "event: message.start",
            "event: message.delta",
            "Provider ",
            "streamed text",
            "event: message.done",
            "\"messageId\":77"
        );
    }
}
