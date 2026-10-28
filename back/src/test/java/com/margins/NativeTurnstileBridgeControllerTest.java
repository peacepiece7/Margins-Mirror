package com.margins;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.controller.NativeTurnstileBridgeController;
import com.margins.auth.dto.NativeTurnstileBridgeCreateResponse;
import com.margins.auth.service.NativeTurnstileBridgeService;
import com.margins.auth.support.ClientIpResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class NativeTurnstileBridgeControllerTest {
    private final NativeTurnstileBridgeService service = mock(NativeTurnstileBridgeService.class);
    private final ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new NativeTurnstileBridgeController(
            service,
            clientIpResolver,
            new ObjectMapper()
        )).build();
    }

    @Test
    void createKeepsSensitiveResponseOutOfCachesAndRequestUrls() throws Exception {
        when(clientIpResolver.resolve(org.mockito.ArgumentMatchers.any()))
            .thenReturn("203.0.113.4");
        when(service.create("reader@example.com", "203.0.113.4"))
            .thenReturn(NativeTurnstileBridgeCreateResponse.builder()
                .bridgeId("bridge-id")
                .nativeProof("native-proof")
                .hostedUrl("https://margins.cloud/api/auth/mobile/email-verification-bridge/bridge-id")
                .expiresInSeconds(240)
                .build());

        mockMvc.perform(post("/api/auth/mobile/email-verification-bridge")
                .contentType("application/json")
                .content("{\"email\":\"reader@example.com\"}"))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", containsString("no-store")))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(jsonPath("$.data.bridgeId").value("bridge-id"))
            .andExpect(jsonPath("$.data.nativeProof").value("native-proof"));
    }

    @Test
    void hostedPageUsesExplicitTurnstileAndHardenedHeadersWithoutSensitiveValues() throws Exception {
        String bridgeId = "b5d1ffaf-cf68-4f1e-89bc-25f3b7e87621";
        doNothing().when(service).requireActive(bridgeId);
        when(service.siteKey()).thenReturn("public-site-key");
        when(service.returnUri()).thenReturn("https://margins.cloud/oauth/email-verification");

        mockMvc.perform(get("/api/auth/mobile/email-verification-bridge/{bridgeId}", bridgeId))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", containsString("no-store")))
            .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(content().string(containsString("api.js?render=explicit")))
            .andExpect(content().string(containsString("turnstile.render")))
            .andExpect(content().string(containsString("JSON.stringify({token})")))
            .andExpect(content().string(containsString("location.replace(returnUri)")))
            .andExpect(content().string(not(containsString("reader@example.com"))))
            .andExpect(content().string(not(containsString("nativeProof"))));
    }
}
