package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.moderation.controller.ModerationController;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.service.ModerationService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ModerationFeedbackControllerTest {
    private ModerationService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        service = mock(ModerationService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new ModerationController(service)).build();
    }

    @Test
    void returnsCompactEventForValidFeedback() throws Exception {
        when(service.feedback(eq(11L), any())).thenReturn(ModerationEventDto.builder()
            .eventId(11L)
            .sessionId(2L)
            .windowId(3L)
            .decision("REJECT")
            .intent("MEANINGLESS")
            .reasonCode("MEANINGLESS")
            .routingOutcome("REJECTED")
            .userFeedback("RELATED")
            .createdAt(Instant.parse("2026-07-29T00:00:00Z"))
            .build());

        mockMvc.perform(post("/api/moderation-events/11/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"feedback\":\"RELATED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.eventId").value(11))
            .andExpect(jsonPath("$.data.userFeedback").value("RELATED"));
    }

    @Test
    void rejectsUnknownFeedbackEnum() throws Exception {
        mockMvc.perform(post("/api/moderation-events/11/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"feedback\":\"MAYBE\"}"))
            .andExpect(status().isBadRequest());
    }
}
