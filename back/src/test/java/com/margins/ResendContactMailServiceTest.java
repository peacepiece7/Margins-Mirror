package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.config.ResendProperties;
import com.margins.contact.config.ContactProperties;
import com.margins.contact.model.ContactInquiry;
import com.margins.contact.service.ContactDeliveryException;
import com.margins.contact.service.ResendContactMailService;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ResendContactMailServiceTest {
    private HttpServer server;
    private AtomicReference<String> body;
    private AtomicReference<String> idempotencyKey;
    private AtomicReference<String> userAgent;
    private int status;
    private String response;

    @BeforeEach
    void start() throws Exception {
        body = new AtomicReference<>();
        idempotencyKey = new AtomicReference<>();
        userAgent = new AtomicReference<>();
        status = 200;
        response = "{\"id\":\"provider-id-7\"}";
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/emails", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            idempotencyKey.set(exchange.getRequestHeaders().getFirst("Idempotency-Key"));
            userAgent.set(exchange.getRequestHeaders().getFirst("User-Agent"));
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
    }

    @AfterEach void stop() { server.stop(0); }

    @Test
    void sendsFixedRecipientPlainTextAndDeterministicIdempotencyKey() throws Exception {
        assertThat(service().send(inquiry())).isEqualTo("provider-id-7");

        JsonNode request = new ObjectMapper().readTree(body.get());
        assertThat(request.path("from").asText()).isEqualTo("Margins <no-reply@example.com>");
        assertThat(request.path("to").get(0).asText()).isEqualTo("support@margins.cloud");
        assertThat(request.path("subject").asText()).isEqualTo("New Margins contact inquiry #7");
        assertThat(request.path("text").asText())
            .contains("reader@example.com", "<script>alert(1)</script>", "Need help");
        assertThat(request.has("html")).isFalse();
        assertThat(idempotencyKey.get()).isEqualTo("contact-inquiry-7");
        assertThat(userAgent.get()).isEqualTo("Margins/1.0");
    }

    @Test
    void distinguishesProviderRejectionAndMissingProviderId() {
        status = 429;
        assertThatThrownBy(() -> service().send(inquiry()))
            .isInstanceOfSatisfying(ContactDeliveryException.class,
                error -> assertThat(error.getFailureCode()).isEqualTo("PROVIDER_REJECTED"));
        status = 200;
        response = "{}";
        assertThatThrownBy(() -> service().send(inquiry()))
            .isInstanceOfSatisfying(ContactDeliveryException.class,
                error -> assertThat(error.getFailureCode()).isEqualTo("INVALID_RESPONSE"));
        response = "{\"id\":\"" + "x".repeat(129) + "\"}";
        assertThatThrownBy(() -> service().send(inquiry()))
            .isInstanceOfSatisfying(ContactDeliveryException.class,
                error -> assertThat(error.getFailureCode()).isEqualTo("INVALID_RESPONSE"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordsTimeoutWithoutProviderDetails() throws Exception {
        HttpClient client = mock(HttpClient.class);
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new HttpTimeoutException("sensitive provider timeout detail"));

        assertThatThrownBy(() -> service(client).send(inquiry()))
            .isInstanceOfSatisfying(ContactDeliveryException.class,
                error -> assertThat(error.getFailureCode()).isEqualTo("TIMEOUT"))
            .hasMessageNotContaining("sensitive provider timeout detail");
    }

    private ResendContactMailService service() {
        return service(HttpClient.newHttpClient());
    }

    private ResendContactMailService service(HttpClient client) {
        ContactProperties contact = new ContactProperties();
        contact.setEnabled(true);
        contact.setRecipient("support@margins.cloud");
        MailVerificationProperties mail = new MailVerificationProperties();
        mail.setFrom("Margins <no-reply@example.com>");
        ResendProperties resend = new ResendProperties();
        resend.setApiKey("re_test_key");
        resend.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        ResendContactMailService service = new ResendContactMailService(
            client, new ObjectMapper(), contact, mail, resend);
        service.validateStartupConfiguration();
        return service;
    }

    private ContactInquiry inquiry() {
        return ContactInquiry.builder().id(7L).email("reader@example.com").category("BUG_REPORT")
            .subject("Need help").message("<script>alert(1)</script>").build();
    }
}
