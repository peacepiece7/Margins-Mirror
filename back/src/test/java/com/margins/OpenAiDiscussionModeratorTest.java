package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.OpenAiProperties;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.moderation.DiscussionModerationRequest;
import com.margins.moderation.DiscussionModerationResult;
import com.margins.moderation.ModerationDecision;
import com.margins.moderation.ModerationIntent;
import com.margins.moderation.OpenAiDiscussionModerator;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.SessionWindowContext;
import com.margins.session.model.SessionWindowRecord;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class OpenAiDiscussionModeratorTest {

    @Test
    void requestsStrictStoredFalseClassificationWithBoundedContext() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext("/responses", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            String result = """
                {"decision":"REDIRECT","intent":"DISCUSSION_STRUCTURE","relevanceScore":0.12,
                 "confidence":0.91,"reasonCode":"DISCUSSION_STRUCTURE","suggestedQuestion":"provider가 만든 임의 안내"}
                """.replace("\n", "");
            var responseBody = new ObjectMapper().createObjectNode();
            responseBody.put("status", "completed");
            responseBody.putArray("output")
                .addObject()
                .putArray("content")
                .addObject()
                .put("type", "output_text")
                .put("text", result);
            var usage = responseBody.putObject("usage");
            usage.put("input_tokens", 100);
            usage.putObject("input_tokens_details").put("cached_tokens", 64);
            usage.put("output_tokens", 20);
            usage.put("total_tokens", 120);
            String body = responseBody.toString();
            byte[] response = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            SessionWindowMapper windowMapper = mock(SessionWindowMapper.class);
            MessageMapper messageMapper = mock(MessageMapper.class);
            when(windowMapper.findContextById(10L)).thenReturn(
                new SessionWindowContext(10L, 20L, 30L, 40L, "Dune", "Frank Herbert", null, null)
            );
            when(windowMapper.findById(10L)).thenReturn(SessionWindowRecord.builder()
                .id(10L)
                .sessionId(20L)
                .title("권력과 예언")
                .windowType("debate")
                .build());
            when(messageMapper.findRecentByWindowBefore(10L, null, 8)).thenReturn(List.of(
                MessageRecord.builder().role("user").content("예언은 책임을 지우나요?").build()
            ));
            OpenAiProperties openAi = new OpenAiProperties();
            openAi.setApiKey("test-key");
            openAi.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiDiscussionModerator moderator = new OpenAiDiscussionModerator(
                openAi,
                new ObjectMapper(),
                windowMapper,
                messageMapper,
                responsesTransport(openAi)
            );

            var generation = moderator.moderateWithMetadata(
                new DiscussionModerationRequest("request-1", 10L, "나말고 다른 사람은 없어요?"),
                new AiGenerationTask(
                    "MODERATOR", "prompt-v1", "schema-v1", com.margins.ai.GenerationLocale.KO
                )
            );
            DiscussionModerationResult result = generation.value();

            assertThat(result.getDecision()).isEqualTo(ModerationDecision.REDIRECT);
            assertThat(result.getIntent()).isEqualTo(ModerationIntent.DISCUSSION_STRUCTURE);
            assertThat(result.getSuggestedQuestion()).contains("Me + Director");
            assertThat(result.getSuggestedQuestion()).doesNotContain("provider가 만든");
            assertThat(result.isFallbackUsed()).isFalse();
            assertThat(generation.cachedInputTokens()).isEqualTo(64);
            assertThat(generation.inputTokens()).isEqualTo(100);
            assertThat(generation.outputTokens()).isEqualTo(20);
            assertThat(requestBody.get())
                .contains("\"model\":\"gpt-5.6-luna\"")
                .contains("\"store\":false")
                .contains("\"type\":\"json_schema\"")
                .contains("\"strict\":true")
                .contains("\"additionalProperties\":false")
                .contains("DISCUSSION_STRUCTURE")
                .doesNotContain("\"test-key\"");
            moderator.moderateWithMetadata(
                new DiscussionModerationRequest("request-2", 10L, "How does this discussion work?"),
                new AiGenerationTask(
                    "MODERATOR", "prompt-v1", "schema-v1", com.margins.ai.GenerationLocale.EN
                )
            );
            assertThat(requestBody.get())
                .contains("Respond in English.")
                .contains("required response language")
                .doesNotContain("Respond in Korean.")
                .doesNotContain("must be Korean");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void malformedOrContradictoryOutputDegradesToAllow() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {"output_text":"{\\"decision\\":\\"ALLOW\\",\\"intent\\":\\"SPAM\\",
                \\"relevanceScore\\":0.1,\\"confidence\\":0.9,\\"reasonCode\\":\\"SPAM\\",
                \\"suggestedQuestion\\":\\"\\"}"}
                """.replace("\n", "").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties openAi = new OpenAiProperties();
            openAi.setApiKey("test-key");
            openAi.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            SessionWindowMapper windowMapper = mock(SessionWindowMapper.class);
            MessageMapper messageMapper = mock(MessageMapper.class);
            OpenAiDiscussionModerator moderator = new OpenAiDiscussionModerator(
                openAi,
                new ObjectMapper(),
                windowMapper,
                messageMapper,
                responsesTransport(openAi)
            );

            DiscussionModerationResult result = moderator.moderateWithMetadata(
                new DiscussionModerationRequest("request-2", 10L, "spam"),
                new AiGenerationTask(
                    "MODERATOR", "prompt-v1", "schema-v1", com.margins.ai.GenerationLocale.KO
                )
            ).value();

            assertThat(result.getDecision()).isEqualTo(ModerationDecision.ALLOW);
            assertThat(result.getIntent()).isEqualTo(ModerationIntent.BOOK_DISCUSSION);
            assertThat(result.getReasonCode()).isEqualTo("MODERATOR_UNAVAILABLE");
            assertThat(result.isFallbackUsed()).isTrue();
            assertThat(result.getProviderErrorCode()).isEqualTo("MODERATOR_PROVIDER_ERROR");
            verify(messageMapper).findRecentByWindowBefore(eq(10L), eq(null), eq(8));
        } finally {
            server.stop(0);
        }
    }

    private static OpenAiResponsesTransport responsesTransport(OpenAiProperties properties) {
        return new OpenAiResponsesTransport(
            properties,
            new ObjectMapper(),
            HttpClient.newHttpClient()
        );
    }
}
