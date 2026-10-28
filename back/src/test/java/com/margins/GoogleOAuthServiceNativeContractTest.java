package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.service.GoogleOAuthService;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class GoogleOAuthServiceNativeContractTest {
    @Test
    void nativeAuthorizationUsesBackendCallbackNonceAndPkceWithoutClientSecret() {
        GoogleAuthProperties properties = new GoogleAuthProperties();
        properties.setEnabled(true);
        properties.setClientId("client-id");
        properties.setClientSecret("must-not-appear");
        GoogleOAuthService service = new GoogleOAuthService(
            properties, new ObjectMapper(), RestClient.builder());

        String url = service.buildNativeAuthorizationUrl("state", "nonce", "challenge");

        assertThat(url)
            .contains("state=state", "nonce=nonce", "code_challenge=challenge", "code_challenge_method=S256")
            .contains("%2Fapi%2Fmobile%2Fauth%2Foauth%2Fgoogle%2Fcallback")
            .doesNotContain("must-not-appear");
    }
}
