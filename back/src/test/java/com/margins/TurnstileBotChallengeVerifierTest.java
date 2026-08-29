package com.margins;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.service.TurnstileBotChallengeVerifier;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TurnstileBotChallengeVerifierTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void acceptsExpectedActionAndHostnameAndSendsRemoteIp() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        String endpoint = start(200,
            "{\"success\":true,\"action\":\"email_verification\",\"hostname\":\"margins.cloud\"}",
            requestBody);

        verifier(endpoint).verify("one-time-token", "203.0.113.4");

        org.assertj.core.api.Assertions.assertThat(requestBody.get())
            .contains("secret=test-secret")
            .contains("response=one-time-token")
            .contains("remoteip=203.0.113.4");
    }

    @Test
    void rejectsFailureWrongActionAndWrongHostnameAsInvalid() throws Exception {
        for (String body : List.of(
            "{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}",
            "{\"success\":true,\"action\":\"other\",\"hostname\":\"margins.cloud\"}",
            "{\"success\":true,\"action\":\"email_verification\",\"hostname\":\"evil.example\"}"
        )) {
            assertThatThrownBy(() -> verifier(start(200, body, new AtomicReference<>()))
                .verify("token", "203.0.113.4"))
                .isInstanceOfSatisfying(ApiException.class,
                    error -> org.assertj.core.api.Assertions.assertThat(error.getCode())
                        .isEqualTo(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID));
            stopServer();
            server = null;
        }
    }

    @Test
    void mapsProviderFailureToUnavailableWithoutLeakingProviderDetails() throws Exception {
        assertThatThrownBy(() -> verifier(start(503, "provider internal detail", new AtomicReference<>()))
            .verify("sensitive-token", "203.0.113.4"))
            .isInstanceOfSatisfying(ApiException.class,
                error -> org.assertj.core.api.Assertions.assertThat(error.getCode())
                    .isEqualTo(ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE))
            .hasMessageNotContaining("provider internal detail")
            .hasMessageNotContaining("sensitive-token");
    }

    @Test
    void rejectsMissingTokenBeforeNetworkCall() {
        EmailVerificationAbuseProperties properties = properties("http://127.0.0.1:1/siteverify");
        assertThatThrownBy(() -> new TurnstileBotChallengeVerifier(
            HttpClient.newHttpClient(), new ObjectMapper(), properties).verify(" ", "127.0.0.1"))
            .isInstanceOfSatisfying(ApiException.class,
                error -> org.assertj.core.api.Assertions.assertThat(error.getCode())
                    .isEqualTo(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID));
    }

    private TurnstileBotChallengeVerifier verifier(String endpoint) {
        return new TurnstileBotChallengeVerifier(
            HttpClient.newHttpClient(), new ObjectMapper(), properties(endpoint));
    }

    private EmailVerificationAbuseProperties properties(String endpoint) {
        EmailVerificationAbuseProperties properties = new EmailVerificationAbuseProperties();
        properties.setEnabled(true);
        properties.setRateLimitSecret("rate-secret");
        properties.getTurnstile().setSecretKey("test-secret");
        properties.getTurnstile().setSiteVerifyUrl(endpoint);
        properties.getTurnstile().setAllowedHostnames(List.of("margins.cloud"));
        return properties;
    }

    private String start(int status, String response, AtomicReference<String> requestBody)
        throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/siteverify", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/siteverify";
    }
}
