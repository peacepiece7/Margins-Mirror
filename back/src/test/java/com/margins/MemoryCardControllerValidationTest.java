package com.margins;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.margins.auth.config.SecurityConfig;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.memorycard.controller.MemoryCardController;
import com.margins.memorycard.service.MemoryCardService;
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
    controllers = MemoryCardController.class
)
class MemoryCardControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MemoryCardService memoryCardService;

    @Test
    void memorizedUpdateRejectsMissingValueBeforeBusinessLogic() throws Exception {
        mockMvc.perform(patch("/api/memory-cards/1/memorized")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(memoryCardService);
    }

    @Test
    void groupListPassesOptionalBookFilterToService() throws Exception {
        mockMvc.perform(get("/api/memory-card-groups").param("bookId", "42"))
            .andExpect(status().isOk());

        verify(memoryCardService).groups(42L);
    }

    @Test
    void groupCreateRejectsNonPositiveBookIdBeforeBusinessLogic() throws Exception {
        mockMvc.perform(post("/api/memory-card-groups")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bookId\":0,\"title\":\"Invalid scope\"}"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(memoryCardService);
    }
}
