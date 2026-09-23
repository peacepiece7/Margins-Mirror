package com.margins;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.book.controller.BookController;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.service.BookService;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(
    excludeAutoConfiguration = SecurityAutoConfiguration.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = {SecurityConfig.class, JwtAuthenticationFilter.class}),
    controllers = BookController.class
)
class BookControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BookService bookService;

    @Test
    void searchRejectsBlankQuery() throws Exception {
        mockMvc.perform(post("/api/books/search-candidates")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"query\":\"   \"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(bookService);
    }

    @Test
    void searchRejectsPaginationOutsideDtoLimits() throws Exception {
        mockMvc.perform(post("/api/books/search-candidates")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"query\":\"Dune\",\"page\":1001,\"limit\":41}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(bookService);
    }

    @Test
    void saveRejectsMissingTitle() throws Exception {
        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"candidateId\":\"c1\",\"author\":\"Author\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(bookService);
    }

    @Test
    void saveRejectsOverlongTitleBeforeBusinessLogic() throws Exception {
        String title = "a".repeat(256);

        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"candidateId":"c1","title":"%s","author":"Author"}
                    """.formatted(title)))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(bookService);
    }

    @Test
    void updateRejectsBlankAuthorBeforeBusinessLogic() throws Exception {
        mockMvc.perform(patch("/api/books/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Book\",\"author\":\"   \"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(bookService);
    }

    @Test
    void updateShelfRejectsOutOfRangeRatingBeforeBusinessLogic() throws Exception {
        mockMvc.perform(patch("/api/books/1/shelf")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":6.0}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(bookService);
    }

    @Test
    void regenerateAcceptsBackgroundKnowledgeWork() throws Exception {
        when(bookService.regenerateBookKnowledge(52L)).thenReturn(
            BookKnowledgeDto.builder()
                .knowledgeId(10L)
                .title("Accepted")
                .generationLocale("ko")
                .status("ready")
                .refreshPending(true)
                .build()
        );

        mockMvc.perform(post("/api/books/52/knowledge/regenerate"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.data.knowledgeId").value(10))
            .andExpect(jsonPath("$.data.refreshPending").value(true));

        verify(bookService).regenerateBookKnowledge(52L);
    }
}
