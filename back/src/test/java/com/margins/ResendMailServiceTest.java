package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.config.ResendProperties;
import com.margins.auth.service.MailDeliveryException;
import com.margins.auth.service.ResendMailService;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ResendMailServiceTest {

    private HttpServer server;
    private AtomicReference<String> requestBody;
    private AtomicReference<String> authorization;
    private AtomicReference<String> idempotencyKey;
    private int responseStatus;
    private String responseBody;

    @BeforeEach
    void setUp() throws IOException {
        requestBody = new AtomicReference<>();
        authorization = new AtomicReference<>();
        idempotencyKey = new AtomicReference<>();
        responseStatus = 200;
        responseBody = "{\"id\":\"email-id-123\"}";
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/emails", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            idempotencyKey.set(exchange.getRequestHeaders().getFirst("Idempotency-Key"));
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(responseStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void tearDown() { server.stop(0); }

    @Test
    void sendsResendRequestAndParsesEmailId() throws Exception {
        ResendMailService service = service();
        service.sendVerificationCode("reader@example.com", "123456", 300);

        JsonNode request = new ObjectMapper().readTree(requestBody.get());
        assertThat(request.path("from").asText()).isEqualTo("Margins <no-reply@example.com>");
        assertThat(request.path("to").get(0).asText()).isEqualTo("reader@example.com");
        assertThat(request.path("subject").asText()).isEqualTo("Margins 회원가입 인증");
        assertThat(request.path("html").asText()).contains("123456").contains("5분");
        assertThat(request.path("text").asText()).contains("123456").contains("5분");
        assertThat(authorization.get()).isEqualTo("Bearer re_test_key");
        assertThat(idempotencyKey.get()).matches("[0-9a-f-]{36}");
    }

    @Test
    void convertsProviderFailureToMailDeliveryException() {
        responseStatus = 429;
        assertThatThrownBy(() -> service().sendVerificationCode("reader@example.com", "123456", 60))
            .isInstanceOf(MailDeliveryException.class);
    }

    @Test
    void rejectsSuccessfulResponseWithoutEmailId() {
        responseBody = "{}";
        assertThatThrownBy(() -> service().sendVerificationCode("reader@example.com", "123456", 60))
            .isInstanceOf(MailDeliveryException.class);
    }

    private ResendMailService service() {
        MailVerificationProperties mail = new MailVerificationProperties();
        mail.setFrom("Margins <no-reply@example.com>");
        ResendProperties resend = new ResendProperties();
        resend.setApiKey("re_test_key");
        resend.setBaseUrl("http://localhost:" + server.getAddress().getPort());
        ResendMailService service = new ResendMailService(
            HttpClient.newHttpClient(), new ObjectMapper(), mail, resend);
        service.validateStartupConfiguration();
        return service;
    }
}
