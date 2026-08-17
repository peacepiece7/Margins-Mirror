package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.margins.ai.OpenAiProperties;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class OpenAiResponsesTransportTest {

    @Test
    void sendsResponsesRequestAndNormalizesNestedOutputAndUsage() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> accept = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext("/responses", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            accept.set(exchange.getRequestHeaders().getFirst("Accept"));
            requestBody.set(new String(
                exchange.getRequestBody().readAllBytes(),
                StandardCharsets.UTF_8
            ));
            byte[] response = """
                {
                  "status":"completed",
                  "output":[{"content":[{"type":"output_text","text":"normalized"}]}],
                  "usage":{
                    "input_tokens":21,
                    "input_tokens_details":{"cached_tokens":13},
                    "output_tokens":8,
                    "total_tokens":29
                  }
                }
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            var response = fixture.transport().execute(request(fixture.objectMapper(), false));

            assertThat(response.status()).isEqualTo("completed");
            assertThat(response.incompleteReason()).isBlank();
            assertThat(response.outputText()).isEqualTo("normalized");
            assertThat(response.tokenUsage().inputTokens()).isEqualTo(21);
            assertThat(response.tokenUsage().cachedInputTokens()).isEqualTo(13);
            assertThat(response.tokenUsage().outputTokens()).isEqualTo(8);
            assertThat(authorization.get()).isEqualTo("Bearer test-key");
            assertThat(accept.get()).isEqualTo("application/json");
            assertThat(requestBody.get())
                .contains("\"store\":false")
                .doesNotContain("test-key");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void preservesSanitizedIncompleteMetadataWithoutRequiringOutputText() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {
                  "status":"incomplete",
                  "incomplete_details":{"reason":"max_output_tokens"},
                  "usage":{"input_tokens":21,"output_tokens":2000,"total_tokens":2021}
                }
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            var response = fixture.transport().execute(request(fixture.objectMapper(), false));

            assertThat(response.status()).isEqualTo("incomplete");
            assertThat(response.incompleteReason()).isEqualTo("max_output_tokens");
            assertThat(response.outputText()).isBlank();
            assertThat(response.tokenUsage().outputTokens()).isEqualTo(2000);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void replacesUnexpectedIncompleteMetadataWithoutExposingIt() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {
                  "status":"incomplete",
                  "incomplete_details":{"reason":"private reader content 123"}
                }
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            var response = fixture.transport().execute(request(fixture.objectMapper(), false));

            assertThat(response.incompleteReason()).isEqualTo("unknown");
            assertThat(response.incompleteReason()).doesNotContain("reader");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void stillRejectsCompletedResponseWithoutOutputText() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {"status":"completed","usage":{"input_tokens":1,"output_tokens":0}}
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            assertThatThrownBy(() -> fixture.transport().execute(
                request(fixture.objectMapper(), false)
            ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("OpenAI response did not include text output");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void normalizesEventStreamForTextAndStreamingCalls() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = String.join("",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"shared \"}\n\n",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"output\"}\n\n",
                "data: {\"type\":\"response.completed\",\"response\":{\"usage\":{"
                    + "\"input_tokens\":34,\"input_tokens_details\":{\"cached_tokens\":21},"
                    + "\"output_tokens\":5,\"total_tokens\":39}}}\n\n"
            ).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            var text = fixture.transport().execute(request(fixture.objectMapper(), false));
            List<String> deltas = new ArrayList<>();
            var stream = fixture.transport().executeStream(
                request(fixture.objectMapper(), true),
                deltas::add
            );

            assertThat(text.outputText()).isEqualTo("shared output");
            assertThat(text.tokenUsage().cachedInputTokens()).isEqualTo(21);
            assertThat(stream.outputText()).isEqualTo("shared output");
            assertThat(stream.tokenUsage().totalTokens()).isEqualTo(39);
            assertThat(deltas).containsExactly("shared ", "output");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void rejectsNonSuccessfulResponseWithoutExposingRawBody() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = "raw-provider-secret-content".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(429, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            assertThatThrownBy(() -> fixture.transport().execute(
                request(fixture.objectMapper(), false)
            ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("OpenAI request failed: 429")
                .hasMessageNotContaining("raw-provider-secret-content")
                .hasMessageNotContaining("test-key");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void preservesTimeoutAsRootCauseForDomainClassification() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            try {
                Thread.sleep(1_500);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
            exchange.close();
        });
        server.start();

        try {
            Fixture fixture = fixture(server);
            fixture.properties().setTimeoutSeconds(1);

            assertThatThrownBy(() -> fixture.transport().execute(
                request(fixture.objectMapper(), false)
            ))
                .isInstanceOf(IllegalStateException.class)
                .hasRootCauseInstanceOf(HttpTimeoutException.class);
        } finally {
            server.stop(0);
        }
    }

    private static Fixture fixture(HttpServer server) {
        OpenAiProperties properties = new OpenAiProperties();
        properties.setApiKey("test-key");
        properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        ObjectMapper objectMapper = new ObjectMapper();
        return new Fixture(
            properties,
            objectMapper,
            new OpenAiResponsesTransport(
                properties,
                objectMapper,
                HttpClient.newHttpClient()
            )
        );
    }

    private static ObjectNode request(ObjectMapper objectMapper, boolean streaming) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("model", "test-model");
        request.put("store", false);
        request.put("stream", streaming);
        return request;
    }

    private record Fixture(
        OpenAiProperties properties,
        ObjectMapper objectMapper,
        OpenAiResponsesTransport transport
    ) {
    }
}
