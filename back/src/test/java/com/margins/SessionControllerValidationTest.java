package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.message.controller.MessageController;
import com.margins.message.service.MessageService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.metric.controller.MetricController;
import com.margins.metric.service.MetricService;
import com.margins.persona.controller.PersonaController;
import com.margins.persona.service.PersonaService;
import com.margins.persona.service.PersonaRecommendationService;
import com.margins.question.controller.QuestionController;
import com.margins.session.controller.ReadingSessionController;
import com.margins.session.controller.SessionWindowController;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.service.ReadingSessionService;
import com.margins.session.service.SessionWindowService;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = {SecurityConfig.class, JwtAuthenticationFilter.class}),
    controllers = {ReadingSessionController.class, SessionWindowController.class, MessageController.class, QuestionController.class, PersonaController.class, MetricController.class}
)
class SessionControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ReadingSessionService readingSessionService;

    @MockBean
    private SessionWindowService sessionWindowService;

    @MockBean
    private MessageService messageService;

    @MockBean
    private MetricService metricService;

    @MockBean
    private PersonaService personaService;

    @MockBean
    private PersonaRecommendationService personaRecommendationService;

    @Test
    void readingSessionRejectsMissingTitle() throws Exception {
        mockMvc.perform(post("/api/reading-sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bookId\":1}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(readingSessionService);
    }

    @Test
    void readingSessionRejectsOverlongTitleBeforeBusinessLogic() throws Exception {
        String title = "a".repeat(256);

        mockMvc.perform(post("/api/reading-sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"bookId":1,"title":"%s"}
                    """.formatted(title)))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(readingSessionService);
    }

    @Test
    void sessionWindowRejectsMissingTitle() throws Exception {
        mockMvc.perform(post("/api/session-windows")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sessionId\":1,\"windowType\":\"question\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void sessionWindowRejectsOverlongWindowTypeBeforeBusinessLogic() throws Exception {
        String windowType = "a".repeat(41);

        mockMvc.perform(post("/api/session-windows")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"sessionId":1,"windowType":"%s","title":"Reflection"}
                    """.formatted(windowType)))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void sessionWindowRejectsOverlongTitleBeforeBusinessLogic() throws Exception {
        String title = "a".repeat(256);

        mockMvc.perform(post("/api/session-windows")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"sessionId":1,"windowType":"question","title":"%s"}
                    """.formatted(title)))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void sessionWindowTitleRejectsBlankTitle() throws Exception {
        mockMvc.perform(patch("/api/session-windows/1/title")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void sessionWindowCreateMissingReadingSessionUsesApiResponseFailureShape() throws Exception {
        when(sessionWindowService.create(any()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Reading session not found"));

        mockMvc.perform(post("/api/session-windows")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sessionId\":404,\"windowType\":\"question\",\"title\":\"Missing parent\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void readingSessionCreateMissingBookUsesApiResponseFailureShape() throws Exception {
        when(readingSessionService.create(any()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        mockMvc.perform(post("/api/reading-sessions")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"bookId\":404,\"title\":\"Missing book session\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void messageRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/session-windows/1/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void streamedMessageRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/session-windows/1/messages/stream")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void streamedMessageEmitsStartDeltaAndDoneEvents() throws Exception {
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
                .aiModel("test-model")
                .build();
        }).when(sessionWindowService).streamMessage(eq(1L), any(SendMessageRequest.class), any());

        MvcResult streamingResult = mockMvc.perform(post("/api/session-windows/1/messages/stream")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"hello\",\"clientCorrelationId\":\"client-1\"}"))
            .andExpect(request().asyncStarted())
            .andReturn();

        MvcResult dispatchedResult = mockMvc.perform(asyncDispatch(streamingResult))
            .andExpect(status().isOk())
            .andReturn();
        String stream = dispatchedResult.getResponse().getContentAsString();

        assertThat(stream).contains(
            "event: message.start",
            "\"clientCorrelationId\":\"client-1\"",
            "event: message.delta",
            "Provider ",
            "streamed text",
            "event: message.done",
            "\"messageId\":77"
        );
        assertThat(stream.indexOf("event: message.start")).isLessThan(stream.indexOf("event: message.delta"));
        assertThat(stream.indexOf("event: message.delta")).isLessThan(stream.indexOf("event: message.done"));
    }

    @Test
    void streamedMessageEmitsErrorEventAfterStreamOpens() throws Exception {
        when(sessionWindowService.streamMessage(eq(1L), any(SendMessageRequest.class), any()))
            .thenThrow(new IllegalStateException("AI provider unavailable"));

        MvcResult streamingResult = mockMvc.perform(post("/api/session-windows/1/messages/stream")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"hello\",\"clientCorrelationId\":\"client-2\"}"))
            .andExpect(request().asyncStarted())
            .andReturn();

        MvcResult dispatchedResult = mockMvc.perform(asyncDispatch(streamingResult))
            .andExpect(status().isOk())
            .andReturn();
        String stream = dispatchedResult.getResponse().getContentAsString();

        assertThat(stream).contains(
            "event: message.start",
            "\"clientCorrelationId\":\"client-2\"",
            "event: message.error",
            "\"code\":\"STREAM_MESSAGE_FAILED\""
        );
        assertThat(stream).doesNotContain("AI provider unavailable", "\"message\"");
        assertThat(stream.indexOf("event: message.start")).isLessThan(stream.indexOf("event: message.error"));
    }

    @Test
    void customQuestionRejectsBlankText() throws Exception {
        mockMvc.perform(post("/api/session-windows/1/questions")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"questionText\":\"\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields[0].field").value("questionText"));

        verifyNoInteractions(sessionWindowService);
    }

    @Test
    void responseStatusExceptionUsesApiResponseFailureShape() throws Exception {
        doThrow(new ApiException(ApiErrorCode.SESSION_ANSWERED_QUESTION_DELETE_CONFLICT))
            .when(sessionWindowService).deleteQuestion(9L);

        mockMvc.perform(delete("/api/questions/9"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("SESSION_ANSWERED_QUESTION_DELETE_CONFLICT"));
    }

    @Test
    void lastWindowArchiveConflictUsesApiResponseFailureShape() throws Exception {
        doThrow(new ApiException(ApiErrorCode.SESSION_LAST_WINDOW_REQUIRED))
            .when(sessionWindowService).archive(1L);

        mockMvc.perform(delete("/api/session-windows/1"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("SESSION_LAST_WINDOW_REQUIRED"));
    }

    @Test
    void missingSessionWindowMutationUsesApiResponseFailureShape() throws Exception {
        when(sessionWindowService.updateTitle(eq(404L), any()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Session window not found"));

        mockMvc.perform(patch("/api/session-windows/404/title")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Missing window\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }


    @Test
    void missingMetricSnapshotSessionUsesApiResponseFailureShape() throws Exception {
        when(metricService.createSessionSnapshot(404L))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Reading session not found"));

        mockMvc.perform(post("/api/reading-sessions/404/metrics/snapshot"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void missingReadingSessionChildMutationUsesApiResponseFailureShape() throws Exception {
        when(readingSessionService.updateHighlight(eq(1L), eq(404L), any()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Session highlight not found"));

        mockMvc.perform(patch("/api/reading-sessions/1/highlights/404")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"quoteText\":\"missing highlight\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void messageQuestionMismatchUsesApiResponseFailureShape() throws Exception {
        when(sessionWindowService.sendMessage(eq(1L), any(SendMessageRequest.class)))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found for session window"));

        mockMvc.perform(post("/api/session-windows/1/messages")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"answer\",\"questionId\":99}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void debateMissingPersonaUsesApiResponseFailureShape() throws Exception {
        when(sessionWindowService.debate(eq(1L), any()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Persona not found"));

        mockMvc.perform(post("/api/session-windows/1/debate")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"challenge\",\"personaId\":99}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void debateAllAcceptsContentWithoutPersonaId() throws Exception {
        when(sessionWindowService.debateAll(eq(1L), any()))
            .thenReturn(DebateTurnResponse.builder()
                .messages(List.of())
                .build());

        mockMvc.perform(post("/api/session-windows/1/debate/all")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"compare interpretations\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void debateAllRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/session-windows/1/debate/all")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void personaRejectsBlankRequiredFields() throws Exception {
        mockMvc.perform(post("/api/personas")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"\",\"systemPrompt\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(personaService);
    }

    @Test
    void personaRejectsOverlongDisplayNameBeforeBusinessLogic() throws Exception {
        String displayName = "a".repeat(121);

        mockMvc.perform(post("/api/personas")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"displayName":"%s","systemPrompt":"Read with care."}
                    """.formatted(displayName)))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(personaService);
    }


    @Test
    void sessionTagRejectsBlankLabel() throws Exception {
        mockMvc.perform(post("/api/reading-sessions/1/tags")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(readingSessionService);
    }

    @Test
    void sessionInsightRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/reading-sessions/1/insights")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(readingSessionService);
    }

    @Test
    void reviewCommentRejectsBlankContent() throws Exception {
        mockMvc.perform(post("/api/reading-sessions/public-reviews/1/comments")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(readingSessionService);
    }

    @Test
    void reviewCommentEditRejectsBlankContent() throws Exception {
        mockMvc.perform(patch("/api/reading-sessions/public-reviews/1/comments/2")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(readingSessionService);
    }

    @Test
    void messageEditRejectsBlankContent() throws Exception {
        mockMvc.perform(patch("/api/messages/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(messageService);
    }

    @Test
    void messageEditNotFoundUsesApiResponseFailureShape() throws Exception {
        when(messageService.update(eq(404L), any()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Editable message not found"));

        mockMvc.perform(patch("/api/messages/404")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"Edited\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void messageDeleteCallsControllerWithoutBodyValidation() throws Exception {
        mockMvc.perform(delete("/api/messages/1"))
            .andExpect(status().isOk());
    }

    @Test
    void debateRejectsMissingPersona() throws Exception {
        mockMvc.perform(post("/api/session-windows/1/debate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"hello\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionWindowService);
    }

}
