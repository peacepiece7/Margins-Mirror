package com.margins;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.book.controller.BookBackgroundController;
import com.margins.book.dto.BookBackgroundDto;
import com.margins.book.service.BookBackgroundService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(controllers = BookBackgroundController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = {SecurityConfig.class, JwtAuthenticationFilter.class}))
class BookBackgroundControllerTest {
    @Autowired MockMvc mvc;
    @MockBean BookBackgroundService background;

    @Test void readReturnsNullableSummaryAndVersion() throws Exception {
        when(background.find(7L)).thenReturn(BookBackgroundDto.builder().revision(0).build());
        mvc.perform(get("/api/books/7/knowledge/summary")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.revision").value(0));
    }

    @Test void rejectsMissingNegativeRevisionAndOverlongSummary() throws Exception {
        for (String body : java.util.List.of("{\"summary\":\"text\"}", "{\"summary\":null,\"expectedRevision\":-1}",
            "{\"expectedRevision\":0}",
            "{\"summaryProvided\":true,\"expectedRevision\":0}",
            "{\"summary\":\"" + "a".repeat(10001) + "\",\"expectedRevision\":0}")) {
            mvc.perform(patch("/api/books/7/knowledge/summary").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(background);
    }

    @Test void explicitNullRestoreUsesTheSamePatchContract() throws Exception {
        when(background.update(eq(7L), any())).thenReturn(BookBackgroundDto.builder().revision(3).build());
        mvc.perform(patch("/api/books/7/knowledge/summary").contentType(MediaType.APPLICATION_JSON)
            .content("{\"summary\":null,\"expectedRevision\":2}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.revision").value(3));
        verify(background).update(eq(7L), argThat(request -> request.getSummary() == null && request.getExpectedRevision() == 2));
    }
}
