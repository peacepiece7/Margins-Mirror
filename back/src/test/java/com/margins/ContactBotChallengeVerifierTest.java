package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.contact.config.ContactProperties;
import com.margins.contact.service.ContactBotChallengeVerifier;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContactBotChallengeVerifierTest {
    private HttpServer server;

    @AfterEach void stop() { if (server != null) server.stop(0); }

    @Test
    void rejectsMissingChallengeWithDedicatedPublicCode() {
        ContactProperties properties = new ContactProperties();
        properties.setEnabled(true);
        ContactBotChallengeVerifier verifier = new ContactBotChallengeVerifier(
            HttpClient.newHttpClient(), new ObjectMapper(), properties);

        for (String token : new String[] {null, " "}) {
            assertThatThrownBy(() -> verifier.verify(token, "203.0.113.4"))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getCode())
                    .isEqualTo(ApiErrorCode.CONTACT_INQUIRY_BOT_CHALLENGE_INVALID));
        }
    }

    @Test
    void acceptsOnlyContactActionTrustedHostnameAndSendsNormalizedClientIp() throws Exception {
        AtomicReference<String> body = new AtomicReference<>();
        String endpoint = start(200,
            "{\"success\":true,\"action\":\"contact_inquiry\",\"hostname\":\"margins.cloud\"}", body);

        verifier(endpoint).verify("one-time-token", "203.0.113.4");

        assertThat(body.get()).contains("secret=test-secret", "response=one-time-token", "remoteip=203.0.113.4");
    }

    @Test
    void rejectsWrongPurposeOrHostnameWithoutLeakingToken() throws Exception {
        for (String response : List.of(
            "{\"success\":true,\"action\":\"email_verification\",\"hostname\":\"margins.cloud\"}",
            "{\"success\":true,\"action\":\"contact_inquiry\",\"hostname\":\"evil.example\"}"
        )) {
            String endpoint = start(200, response, new AtomicReference<>());
            assertThatThrownBy(() -> verifier(endpoint).verify("sensitive-token", "203.0.113.4"))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getCode())
                    .isEqualTo(ApiErrorCode.CONTACT_INQUIRY_BOT_CHALLENGE_INVALID))
                .hasMessageNotContaining("sensitive-token");
            stop(); server = null;
        }
    }

    @Test
    void failsClosedWhenProviderIsUnavailable() throws Exception {
        String endpoint = start(503, "provider secret detail", new AtomicReference<>());
        assertThatThrownBy(() -> verifier(endpoint).verify("sensitive-token", "203.0.113.4"))
            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getCode())
                .isEqualTo(ApiErrorCode.CONTACT_INQUIRY_BOT_CHALLENGE_UNAVAILABLE))
            .hasMessageNotContaining("provider secret detail")
            .hasMessageNotContaining("sensitive-token");
    }

    private ContactBotChallengeVerifier verifier(String endpoint) {
        ContactProperties properties = new ContactProperties();
        properties.setEnabled(true);
        properties.getTurnstile().setSecretKey("test-secret");
        properties.getTurnstile().setSiteVerifyUrl(endpoint);
        properties.getTurnstile().setAllowedHostnames(List.of("margins.cloud"));
        return new ContactBotChallengeVerifier(HttpClient.newHttpClient(), new ObjectMapper(), properties);
    }

    private String start(int status, String response, AtomicReference<String> body) throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/siteverify", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/siteverify";
    }
}
