package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.GenerationLocale;
import com.margins.ai.OpenAiAiProvider;
import com.margins.ai.OpenAiProperties;
import com.margins.ai.DiscussionGuideGeneration.Evidence;
import com.margins.ai.DiscussionGuideGeneration.Request;
import com.margins.ai.transport.OpenAiResponsesTransport;
import com.margins.book.dto.BookKnowledgeAnalyzeRequest;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionListResponse;
import com.margins.question.mapper.QuestionMapper;
import com.margins.question.model.QuestionRecord;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.session.model.SessionWindowContext;
import com.margins.session.model.SessionWindowRecord;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class OpenAiAiProviderFallbackTest {

    @Test
    void disabledProviderReturnsLocaleAwareEnglishFallbacksWithNullValidation() {
        OpenAiProperties properties = new OpenAiProperties();
        OpenAiAiProvider provider = provider(properties);
        AiGenerationTask windowTask = task("WINDOW_ANSWER", GenerationLocale.EN);
        AiGenerationTask personaTask = task("PERSONA", GenerationLocale.EN);
        List<String> deltas = new ArrayList<>();

        var sync = provider.answerWindowMessageWithMetadata(
            10L, SendMessageRequest.builder().content("Answer").build(), windowTask
        );
        var stream = provider.streamWindowMessageWithMetadata(
            10L, SendMessageRequest.builder().content("Answer").build(), deltas::add, windowTask
        );
        var persona = provider.answerDebateMessageWithMetadata(
            10L, DebateMessageRequest.builder().personaId(2L).content("Debate").build(), personaTask
        );
        Request koGuide = guideRequest();
        var guide = provider.generateDiscussionGuideWithMetadata(new Request(
            koGuide.windowId(), koGuide.promptVersion(), koGuide.schemaVersion(),
            koGuide.purpose(), koGuide.audienceMode(), koGuide.targetMinutes(),
            koGuide.disclosureMode(), koGuide.facilitationLevel(), koGuide.evidence(),
            GenerationLocale.EN
        ));
        var knowledge = provider.analyzeBookKnowledgeWithMetadata(
            BookKnowledgeAnalyzeRequest.builder()
                .title("Dune")
                .promptVersion("book-v1")
                .generationLocale(GenerationLocale.EN)
                .build()
        );

        assertOrdinaryEnglishFallback(sync);
        assertOrdinaryEnglishFallback(stream);
        assertOrdinaryEnglishFallback(persona);
        assertThat(String.join("", deltas)).isEqualTo(stream.value().getContent());
        assertThat(guide.generationLocale()).isEqualTo(GenerationLocale.EN);
        assertThat(guide.outcome()).isEqualTo("FALLBACK");
        assertThat(guide.fallbackUsed()).isTrue();
        assertThat(guide.languageValidationOutcome()).isNull();
        assertThat(guide.value().goal()).contains("reader's interpretation");
        assertThat(knowledge.generationLocale()).isEqualTo(GenerationLocale.EN);
        assertThat(knowledge.value().getSummary())
            .contains("temporary Book Knowledge")
            .doesNotContainPattern("[\\uAC00-\\uD7A3]");
    }

    @Test
    void streamFailureBeforeFirstDeltaMakesOneRequestAndReturnsEnglishFallback() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger requestCount = new AtomicInteger();
        server.createContext("/responses", exchange -> {
            requestCount.incrementAndGet();
            byte[] response = "data: {\"type\":\"error\",\"error\":{\"message\":\"unavailable\"}}\n\n"
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = configuredProperties(server);
            List<String> deltas = new ArrayList<>();
            var generation = provider(properties).streamWindowMessageWithMetadata(
                10L,
                SendMessageRequest.builder().content("Answer").build(),
                deltas::add,
                task("WINDOW_ANSWER", GenerationLocale.EN)
            );

            assertThat(requestCount.get()).isEqualTo(1);
            assertOrdinaryEnglishFallback(generation);
            assertThat(String.join("", deltas)).isEqualTo(generation.value().getContent());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void requestsBookKnowledgeInTheExplicitTaskLocale() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext("/responses", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            String output = """
                {"summary":"A detailed English summary for discussion and interpretation.",
                 "themes":["growth and responsibility"],
                 "discussionPoints":[{"id":"dp-1","question":"Which choice matters most?",
                 "rationale":"It opens several evidence-based interpretations.",
                 "recommendedPersonaKeys":["journalist","writer"]}],
                 "recommendedPersonas":[],"famousQuotes":[],
                 "keywords":["reading discussion"],"version":"book-v1"}
                """.replace("\n", "");
            byte[] response = ("{\"output_text\":"
                + new ObjectMapper().writeValueAsString(output) + "}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            var generation = provider(configuredProperties(server)).analyzeBookKnowledgeWithMetadata(
                BookKnowledgeAnalyzeRequest.builder()
                    .title("Dune")
                    .promptVersion("book-v1")
                    .generationLocale(GenerationLocale.EN)
                    .build()
            );

            assertThat(generation.generationLocale()).isEqualTo(GenerationLocale.EN);
            assertThat(generation.outcome()).isEqualTo("SUCCESS");
            assertThat(generation.value().getSummary()).startsWith("A detailed English summary");
            assertThat(requestBody.get())
                .contains("Respond in English.")
                .doesNotContain("Summary should be Korean");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void usesReaderSafePlaceholderBehaviorWhenApiKeyIsMissing() {
        OpenAiProperties properties = new OpenAiProperties();
        OpenAiAiProvider provider = new OpenAiAiProvider(
            properties,
            new ObjectMapper(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper(),
            responsesTransport(properties)
        );

        QuestionListResponse questions = provider.suggestQuestionsWithMetadata(
            10L, GenerateQuestionsRequest.builder().count(2).focus("Dune").build(),
            task("QUESTION", GenerationLocale.KO)
        ).value();
        AiMessageResponse answer = provider.answerWindowMessageWithMetadata(
            10L, SendMessageRequest.builder().content("Answer").build(),
            task("WINDOW_ANSWER", GenerationLocale.KO)
        ).value();
        List<String> streamedDeltas = new ArrayList<>();
        AiMessageResponse streamed = provider.streamWindowMessageWithMetadata(
            10L, SendMessageRequest.builder().content("Answer").build(), streamedDeltas::add,
            task("WINDOW_ANSWER", GenerationLocale.KO)
        ).value();
        AiMessageResponse debate = provider.answerDebateMessageWithMetadata(
            10L, DebateMessageRequest.builder().personaId(2L).content("Debate").build(),
            task("PERSONA", GenerationLocale.KO)
        ).value();
        var guide = provider.generateDiscussionGuide(guideRequest());
        var guideMetadata = provider.generateDiscussionGuideWithMetadata(guideRequest());

        assertThat(questions.getQuestions()).hasSize(2);
        assertThat(questions.getQuestions())
            .extracting((question) -> question.getQuestionText())
            .allSatisfy((questionText) -> assertThat(questionText)
                .containsAnyOf("어떤 장면", "어떤 구절")
                .doesNotContain("OpenAI")
                .doesNotContain("integration"));
        assertThat(answer.getAiModel()).isEqualTo("placeholder");
        assertThat(answer.getContent())
            .contains("임시 독서 응답")
            .doesNotContain("OpenAI")
            .doesNotContain("integration");
        assertThat(streamed.getAiModel()).isEqualTo("placeholder");
        assertThat(String.join("", streamedDeltas)).isEqualTo(streamed.getContent());
        assertThat(debate.getPersonaId()).isEqualTo(2L);
        assertThat(debate.getContent()).contains("임시 토론 응답");
        assertThat(guide.provider()).isEqualTo("placeholder");
        assertThat(guide.model()).isEqualTo("placeholder");
        assertThat(guide.fallbackUsed()).isTrue();
        assertThat(guide.items()).hasSize(5);
        assertThat(guideMetadata.provider()).isEqualTo("placeholder");
        assertThat(guideMetadata.outcome()).isEqualTo("FALLBACK");
        assertThat(guideMetadata.fallbackUsed()).isTrue();
    }

    @Test
    void requestsKoreanQuestionGenerationWhenConfigured() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext("/responses", (exchange) -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = ("{\"output_text\":\""
                + "[{\\\"questionText\\\":\\\"이 장면에서 가장 크게 흔들린 해석은 무엇인가요?\\\","
                + "\\\"questionType\\\":\\\"reflection\\\"}]"
                + "\"}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                new FakeSessionWindowMapper(),
                new FakeMessageMapper(),
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            QuestionListResponse response = provider.suggestQuestionsWithMetadata(
                10L,
                GenerateQuestionsRequest.builder().count(1).focus("Dune").build(),
                task("QUESTION", GenerationLocale.KO)
            ).value();

            assertThat(response.getQuestions()).singleElement()
                .extracting((question) -> question.getQuestionText())
                .isEqualTo("이 장면에서 가장 크게 흔들린 해석은 무엇인가요?");
            assertThat(requestBody.get()).contains("Generate concise reading reflection questions in Korean.");
            assertThat(requestBody.get()).contains("Every questionText must be natural Korean");
            assertThat(requestBody.get()).contains("\"model\":\"gpt-5.6-luna\"");
            assertMinimalStoredPayload(requestBody.get(), false);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void requestsStrictDiscussionGuideSchemaAndReturnsProviderMetadata() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        ObjectMapper objectMapper = new ObjectMapper();
        String guide = """
            {
              "goal":"처음 생각의 근거와 대안을 살펴봅니다.",
              "issues":["본문 근거","다른 가능성"],
              "items":[
                {"stage":"WARM_UP","priority":"REQUIRED","question":"가장 먼저 남은 장면은 무엇인가요?","intent":"공통 출발점","sourceAlias":"R1","sensitivity":"LOW","skippable":true,"expectedMinutes":5,"followUps":[]},
                {"stage":"INTERPRETATION","priority":"REQUIRED","question":"해석을 뒷받침하는 근거는 무엇인가요?","intent":"근거 확인","sourceAlias":"A1","sensitivity":"LOW","skippable":true,"expectedMinutes":8,"followUps":[]},
                {"stage":"EXPERIENCE","priority":"REQUIRED","question":"책 속 선택만 놓고 보면 무엇이 보이나요?","intent":"경험 연결","sourceAlias":"R1","sensitivity":"MEDIUM","skippable":true,"expectedMinutes":8,"followUps":[]},
                {"stage":"SOCIAL_VALUE","priority":"REQUIRED","question":"오늘의 사회와 연결하면 어떤 질문이 생기나요?","intent":"가치 확장","sourceAlias":"A1","sensitivity":"LOW","skippable":true,"expectedMinutes":8,"followUps":[]},
                {"stage":"CLOSING","priority":"REQUIRED","question":"처음 생각에서 유지할 문장은 무엇인가요?","intent":"생각 정리","sourceAlias":"R1","sensitivity":"LOW","skippable":true,"expectedMinutes":5,"followUps":[]}
              ]
            }
            """;
        server.createContext("/responses", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = objectMapper.writeValueAsBytes(java.util.Map.of(
                "status",
                "completed",
                "output_text",
                guide,
                "usage",
                java.util.Map.of(
                    "input_tokens", 100,
                    "input_tokens_details", java.util.Map.of("cached_tokens", 40),
                    "output_tokens", 200,
                    "total_tokens", 300
                )
            ));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            properties.setMaxOutputTokens(321);
            properties.setDiscussionGuideMaxOutputTokens(2000);
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                objectMapper,
                new FakeSessionWindowMapper(),
                new FakeMessageMapper(),
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            Request request = new Request(
                10L,
                "guide-v1",
                "schema-v1",
                "THOUGHT_EXPANSION",
                "SELF_AI",
                40,
                "PRIVATE_CONTEXT",
                "BEGINNER",
                List.of(
                    new Evidence("R1", "REFLECTION", 1L, "처음 생각"),
                    new Evidence("A1", "ANSWER", 2L, "첫 답변")
                ),
                GenerationLocale.KO
            );
            var response = provider.generateDiscussionGuide(request);

            assertThat(response.items()).hasSize(5);
            assertThat(response.provider()).isEqualTo("openai");
            assertThat(response.model()).isEqualTo(properties.getModel());
            assertThat(response.tokenUsage())
                .contains("\"cachedInputTokens\":40")
                .contains("\"totalTokens\":300");
            assertThat(response.fallbackUsed()).isFalse();
            assertThat(requestBody.get())
                .contains("\"type\":\"json_schema\"")
                .contains("\"name\":\"discussion_guide\"")
                .contains("\"strict\":true")
                .contains("\"max_output_tokens\":2000")
                .doesNotContain("\"max_output_tokens\":321")
                .contains("Purpose: THOUGHT_EXPANSION")
                .contains("Audience mode: SELF_AI")
                .contains("Target minutes: 40")
                .contains("Disclosure mode: PRIVATE_CONTEXT")
                .contains("R1 [REFLECTION]")
                .contains("A1 [ANSWER]");
            provider.generateDiscussionGuide(new Request(
                request.windowId(), request.promptVersion(), request.schemaVersion(),
                request.purpose(), request.audienceMode(), request.targetMinutes(),
                request.disclosureMode(), request.facilitationLevel(), request.evidence(), GenerationLocale.EN
            ));
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
    void classifiesMalformedDiscussionGuideOutput() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {
                  "status":"completed",
                  "output_text":"not-json",
                  "usage":{"input_tokens":12,"output_tokens":3}
                }
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = configuredProperties(server);
            AiGenerationResult<?> result = provider(properties)
                .generateDiscussionGuideWithMetadata(guideRequest());

            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.failureCategory()).isEqualTo("MALFORMED_OUTPUT");
            assertThat(result.inputTokens()).isEqualTo(12);
            assertThat(result.outputTokens()).isEqualTo(3);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void classifiesIncompleteDiscussionGuideBeforeParsingOutput() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {
                  "status":"incomplete",
                  "incomplete_details":{"reason":"max_output_tokens"},
                  "output_text":"this must not be parsed",
                  "usage":{"input_tokens":120,"output_tokens":2000}
                }
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = configuredProperties(server);
            AiGenerationResult<?> result = provider(properties)
                .generateDiscussionGuideWithMetadata(guideRequest());

            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.failureCategory()).isEqualTo("MALFORMED_OUTPUT");
            assertThat(result.inputTokens()).isEqualTo(120);
            assertThat(result.outputTokens()).isEqualTo(2000);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void classifiesDiscussionGuideRefusalWithoutPersistingProviderContent() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            byte[] response = """
                {"output":[{"content":[{"type":"refusal","refusal":"not available"}]}]}
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = configuredProperties(server);
            AiGenerationResult<?> result = provider(properties)
                .generateDiscussionGuideWithMetadata(guideRequest());

            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.failureCategory()).isEqualTo("REFUSAL");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void classifiesDiscussionGuideTransportFailure() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            exchange.sendResponseHeaders(503, -1);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = configuredProperties(server);
            AiGenerationResult<?> result = provider(properties)
                .generateDiscussionGuideWithMetadata(guideRequest());

            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.failureCategory()).isEqualTo("TRANSPORT");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void classifiesDiscussionGuideTimeout() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", exchange -> {
            try {
                Thread.sleep(1_200);
                exchange.sendResponseHeaders(200, -1);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        server.start();

        try {
            OpenAiProperties properties = configuredProperties(server);
            properties.setTimeoutSeconds(1);
            AiGenerationResult<?> result = provider(properties)
                .generateDiscussionGuideWithMetadata(guideRequest());

            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.failureCategory()).isEqualTo("TIMEOUT");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void streamsOpenAiResponseDeltasWhenConfigured() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext("/responses", (exchange) -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = String.join("",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hel\"}\n\n",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"lo\"}\n\n",
                "data: {\"type\":\"response.completed\",\"response\":{\"usage\":{\"input_tokens\":12,\"input_tokens_details\":{\"cached_tokens\":8},\"output_tokens\":3,\"total_tokens\":15}}}\n\n"
            ).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                new FakeSessionWindowMapper(),
                new FakeMessageMapper(),
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            List<String> deltas = new ArrayList<>();
            AiMessageResponse response = provider.streamWindowMessageWithMetadata(
                10L, SendMessageRequest.builder().content("Answer").build(), deltas::add,
                task("WINDOW_ANSWER", GenerationLocale.EN)
            ).value();

            assertThat(deltas).containsExactly("Hel", "lo");
            assertThat(response.getContent()).isEqualTo("Hello");
            assertThat(response.getAiModel()).isEqualTo(properties.getModel());
            assertThat(response.getTokenUsage()).isEqualTo(
                "{\"inputTokens\":12,\"cachedInputTokens\":8,\"outputTokens\":3,\"totalTokens\":15}"
            );
            assertThat(response.getContextSnapshot()).contains("recentMessageIds");
            assertThat(requestBody.get()).contains("\"stream\":true");
            assertMinimalStoredPayload(requestBody.get(), true);
        } finally {
            server.stop(0);
        }
    }

    private static void assertMinimalStoredPayload(String body, boolean streaming) {
        assertThat(body)
            .contains("\"store\":false")
            .doesNotContain("test-key")
            .doesNotContain("reader@example.com")
            .doesNotContain("010-1234-5678")
            .doesNotContain("google-subject")
            .doesNotContain("Bearer ");
        if (streaming) {
            assertThat(body).contains("\"stream\":true");
        }
    }

    @Test
    void readsEventStreamTextFromNonStreamingResponseWhenProviderReturnsSseBody() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> acceptHeader = new AtomicReference<>();
        server.createContext("/responses", (exchange) -> {
            acceptHeader.set(exchange.getRequestHeaders().getFirst("Accept"));
            byte[] response = String.join("",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Debate \"}\n\n",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"answer\"}\n\n",
                "data: {\"type\":\"response.completed\"}\n\n"
            ).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                new FakeSessionWindowMapper(),
                new FakeMessageMapper(),
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            AiMessageResponse response = provider.answerDebateMessageWithMetadata(
                10L,
                DebateMessageRequest.builder().personaId(2L).content("Debate").build(),
                task("PERSONA", GenerationLocale.EN)
            ).value();

            assertThat(response.getContent()).isEqualTo("Debate answer");
            assertThat(response.getAiModel()).isEqualTo(properties.getModel());
            assertThat(acceptHeader.get()).isEqualTo("application/json");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void includesContextPackAndDebateStateInConfiguredDebatePrompt() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext("/responses", (exchange) -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"output_text\":\"Context aware answer\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                new FakeSessionWindowMapper() {
                    @Override
                    public SessionWindowContext findContextById(Long id) {
                        return new SessionWindowContext(
                            id,
                            1L,
                            1L,
                            11L,
                            "The Left Hand of Darkness",
                            "Ursula K. Le Guin",
                            "9780441478125",
                            "{\"aiProfile\":{\"themes\":[\"estrangement\"],\"source\":{\"confidence\":\"low\"}}}"
                        );
                    }

                    @Override
                    public SessionWindowRecord findById(Long id) {
                        return SessionWindowRecord.builder()
                            .id(id)
                            .sessionId(1L)
                            .windowType("debate")
                            .title("토론: 침묵은 회피인가")
                            .status("open")
                            .build();
                    }
                },
                new FakeMessageMapper() {
                    @Override
                    public List<MessageRecord> findBySessionId(Long sessionId) {
                        return List.of(
                            MessageRecord.builder()
                                .id(1L)
                                .sessionId(sessionId)
                                .windowId(10L)
                                .role("user")
                                .content("주인공의 침묵은 책임 회피처럼 보입니다.")
                                .build(),
                            MessageRecord.builder()
                                .id(2L)
                                .sessionId(sessionId)
                                .windowId(10L)
                                .role("assistant")
                                .personaId(2L)
                                .content("심리학자 관점에서는 방어기제로 볼 수 있습니다.")
                                .build()
                        );
                    }

                    @Override
                    public List<MessageRecord> findRecentByWindowBefore(Long windowId, Long beforeMessageId, int limit) {
                        return findBySessionId(1L);
                    }
                },
                new FakeQuestionMapper() {
                    @Override
                    public List<QuestionRecord> findByWindowId(Long windowId) {
                        return List.of(QuestionRecord.builder()
                            .id(7L)
                            .windowId(windowId)
                            .questionText("침묵은 선택인가, 강요된 반응인가?")
                            .build());
                    }
                },
                new FakePersonaMapper() {
                    @Override
                    public PersonaRecord findActiveById(Long id) {
                        return PersonaRecord.builder()
                            .id(id)
                            .name("psychologist")
                            .displayName("심리학자")
                            .systemPrompt("Respond through a careful psychology lens.")
                            .tone("분석적")
                            .active(true)
                            .build();
                    }
                },
                responsesTransport(properties)
            );

            AiMessageResponse response = provider.answerDebateMessageWithMetadata(
                10L,
                DebateMessageRequest.builder()
                    .personaId(2L)
                    .content("그렇다면 이 침묵을 어떻게 이어서 봐야 할까요?")
                    .build(),
                task("PERSONA", GenerationLocale.KO)
            ).value();

            assertThat(response.getContent()).isEqualTo("Context aware answer");
            assertThat(requestBody.get()).contains("AI Context Pack");
            assertThat(requestBody.get()).contains("Book profile");
            assertThat(requestBody.get()).contains("The Left Hand of Darkness");
            assertThat(requestBody.get()).contains("estrangement");
            assertThat(requestBody.get()).contains("Window type: debate");
            assertThat(requestBody.get()).contains("Recent messages");
            assertThat(requestBody.get()).contains("Claim, Support, Question");
            assertThat(requestBody.get()).doesNotContain("침묵은 선택인가");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void preservesProviderDeltasButRedactsRawStreamErrorMessage() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/responses", (exchange) -> {
            byte[] response = String.join("",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Partial\"}\n\n",
                "data: {\"type\":\"error\",\"error\":{\"message\":\"rate limit from provider\"}}\n\n"
            ).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                new FakeSessionWindowMapper(),
                new FakeMessageMapper(),
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            List<String> deltas = new ArrayList<>();
            assertThatThrownBy(() -> provider.streamWindowMessageWithMetadata(
                10L, SendMessageRequest.builder().content("Answer").build(), deltas::add,
                task("WINDOW_ANSWER", GenerationLocale.EN)
            ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("OpenAI stream failed")
                .hasMessageNotContaining("rate limit from provider");
            assertThat(deltas).containsExactly("Partial");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void fillsMissingPersonaRepliesWhenBatchResponseIsPartial() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<Integer> requestCount = new AtomicReference<>(0);
        server.createContext("/responses", (exchange) -> {
            int currentRequest = requestCount.updateAndGet((count) -> count + 1);
            String output = currentRequest == 1
                ? "[{\"personaId\":1,\"content\":\"Batch answer\"}]"
                : "Missing persona answer";
            int cachedTokens = currentRequest == 1 ? 5 : 7;
            byte[] response = (
                "{\"output_text\":\""
                    + output.replace("\"", "\\\"")
                    + "\",\"usage\":{\"input_tokens\":20,\"input_tokens_details\":{\"cached_tokens\":"
                    + cachedTokens
                    + "},\"output_tokens\":4,\"total_tokens\":24}}"
            ).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                new FakeSessionWindowMapper(),
                new FakeMessageMapper(),
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            AiGenerationResult<List<AiMessageResponse>> generation =
                provider.answerDebateMessagesWithMetadata(
                    10L,
                    List.of(
                        DebateMessageRequest.builder().personaId(1L).content("Debate").build(),
                        DebateMessageRequest.builder().personaId(2L).content("Debate").build()
                    ),
                    new AiGenerationTask(
                        "PERSONA", "persona-response-v1", "text-v1", GenerationLocale.EN
                    )
                );
            List<AiMessageResponse> responses = generation.value();

            assertThat(responses).hasSize(2);
            assertThat(responses).extracting(AiMessageResponse::getPersonaId).containsExactly(1L, 2L);
            assertThat(responses.get(0).getContent()).isEqualTo("Batch answer");
            assertThat(responses.get(1).getContent()).startsWith("This is a temporary discussion response.");
            assertThat(requestCount.get()).isEqualTo(1);
            assertThat(generation.provider()).isEqualTo("openai");
            assertThat(generation.model()).isEqualTo(properties.getModel());
            assertThat(generation.inputTokens()).isEqualTo(20);
            assertThat(generation.cachedInputTokens()).isEqualTo(5);
            assertThat(generation.outputTokens()).isEqualTo(4);
            assertThat(generation.outcome()).isEqualTo("FALLBACK");
            assertThat(generation.fallbackUsed()).isTrue();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void rollsOlderWindowMessagesIntoSummaryAndKeepsEightRecentMessages() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<Integer> requestCount = new AtomicReference<>(0);
        AtomicReference<String> summaryRequest = new AtomicReference<>();
        AtomicReference<String> answerRequest = new AtomicReference<>();
        server.createContext("/responses", (exchange) -> {
            int count = requestCount.updateAndGet(value -> value + 1);
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            if (count == 1) {
                summaryRequest.set(request);
            } else if (count == 2) {
                answerRequest.set(request);
            }
            String output = count == 1 ? "누적 대화 요약" : "최종 답변";
            byte[] response = ("{\"output_text\":\"" + output
                + "\",\"usage\":{\"input_tokens\":20,\"output_tokens\":5,\"total_tokens\":25}}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        AtomicReference<String> storedSnapshot = new AtomicReference<>();
        SessionWindowMapper windowMapper = new FakeSessionWindowMapper() {
            @Override
            public int updateConversationSummaryKo(Long windowId, String summaryJson) {
                storedSnapshot.set(summaryJson);
                return 1;
            }
        };
        MessageMapper messageMapper = new FakeMessageMapper() {
            private List<MessageRecord> messages() {
                List<MessageRecord> result = new ArrayList<>();
                for (long id = 1; id <= 9; id++) {
                    result.add(MessageRecord.builder()
                        .id(id)
                        .windowId(10L)
                        .role(id % 2 == 0 ? "assistant" : "user")
                        .content("message-" + id)
                        .messageOrder((int) id)
                        .build());
                }
                return result;
            }

            @Override
            public List<MessageRecord> findSummaryCandidates(Long windowId, Long afterMessageId, Long beforeMessageId, int limit) {
                return messages();
            }

            @Override
            public List<MessageRecord> findRecentByWindowBefore(Long windowId, Long beforeMessageId, int limit) {
                return messages().subList(1, 9).reversed();
            }
        };

        try {
            OpenAiProperties properties = new OpenAiProperties();
            properties.setApiKey("test-key");
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            OpenAiAiProvider provider = new OpenAiAiProvider(
                properties,
                new ObjectMapper(),
                windowMapper,
                messageMapper,
                new FakeQuestionMapper(),
                new FakePersonaMapper(),
                responsesTransport(properties)
            );

            AiMessageResponse response = provider.answerWindowMessageWithMetadata(
                10L,
                SendMessageRequest.builder().content("current").contextMessageId(10L).build(),
                task("WINDOW_ANSWER", GenerationLocale.KO)
            ).value();

            assertThat(response.getContent()).isEqualTo("최종 답변");
            assertThat(requestCount.get()).isEqualTo(2);
            assertThat(storedSnapshot.get()).contains("\"lastMessageId\":1");
            assertThat(storedSnapshot.get()).contains("\"model\":\"gpt-5.6-luna\"");
            assertThat(storedSnapshot.get()).contains("\"totalTokens\":25");
            assertThat(summaryRequest.get()).contains("\"model\":\"gpt-5.6-luna\"");
            assertThat(answerRequest.get()).contains("\"model\":\"gpt-5.6-luna\"");
            assertThat(answerRequest.get()).contains("Conversation summary");
            assertThat(answerRequest.get()).doesNotContain("message-1");
            assertThat(answerRequest.get()).contains("message-2", "message-9");
        } finally {
            server.stop(0);
        }
    }

    private static OpenAiProperties configuredProperties(HttpServer server) {
        OpenAiProperties properties = new OpenAiProperties();
        properties.setApiKey("test-key");
        properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        return properties;
    }

    private static OpenAiAiProvider provider(OpenAiProperties properties) {
        return new OpenAiAiProvider(
            properties,
            new ObjectMapper(),
            new FakeSessionWindowMapper(),
            new FakeMessageMapper(),
            new FakeQuestionMapper(),
            new FakePersonaMapper(),
            responsesTransport(properties)
        );
    }

    private static Request guideRequest() {
        return new Request(
            10L,
            "guide-v1",
            "schema-v1",
            "THOUGHT_EXPANSION",
            "SELF_AI",
            40,
            "PRIVATE_CONTEXT",
            "BEGINNER",
            List.of(new Evidence("R1", "REFLECTION", 1L, "처음 생각")),
            GenerationLocale.KO
        );
    }

    private static AiGenerationTask task(String taskType, GenerationLocale locale) {
        return new AiGenerationTask(taskType, "test-v1", "text-v1", locale);
    }

    private static void assertOrdinaryEnglishFallback(
        AiGenerationResult<AiMessageResponse> generation
    ) {
        assertThat(generation.generationLocale()).isEqualTo(GenerationLocale.EN);
        assertThat(generation.outcome()).isEqualTo("FALLBACK");
        assertThat(generation.fallbackUsed()).isTrue();
        assertThat(generation.languageValidationOutcome()).isNull();
        assertThat(generation.value().getContent())
            .doesNotContainPattern("[\\uAC00-\\uD7A3]")
            .contains("temporary");
    }

    private static OpenAiResponsesTransport responsesTransport(OpenAiProperties properties) {
        return new OpenAiResponsesTransport(
            properties,
            new ObjectMapper(),
            HttpClient.newHttpClient()
        );
    }

    private static class FakeSessionWindowMapper implements SessionWindowMapper {
        @Override
        public int updateContextSnapshot(Long windowId, String contextSnapshot) {
            return 1;
        }

        @Override
        public int updateConversationSummaryKo(Long windowId, String summaryJson) {
            return 1;
        }

        @Override
        public int updateConversationSummaryEn(Long windowId, String summaryJson) {
            return 1;
        }

        @Override
        public int insert(SessionWindowRecord record) {
            return 1;
        }

        @Override
        public SessionWindowRecord findById(Long id) {
            return SessionWindowRecord.builder().id(id).sessionId(1L).windowType("question").title("Question").status("open").build();
        }

        @Override
        public SessionWindowContext findContextById(Long id) {
            return new SessionWindowContext(id, 1L, 1L);
        }

        @Override
        public SessionWindowRecord findActiveDebateBySourceQuestion(Long questionId, Long userId) {
            return null;
        }

        @Override
        public int updateTitle(Long windowId, String title) {
            return 1;
        }

        @Override
        public int softDelete(Long windowId) {
            return 1;
        }

        @Override
        public int countActiveBySessionId(Long sessionId) {
            return findBySessionId(sessionId).size();
        }

        @Override
        public int countActiveSessionById(Long sessionId, Long userId) {
            return 1;
        }

        @Override
        public int selectNextPosition(Long sessionId) {
            return 1;
        }

        @Override
        public List<SessionWindowRecord> findBySessionId(Long sessionId) {
            return List.of();
        }
    }

    private static class FakeMessageMapper implements MessageMapper {
        @Override
        public int insert(MessageRecord record) {
            return 1;
        }

        @Override
        public int selectNextOrder(Long sessionId, Long windowId) {
            return 1;
        }

        @Override
        public List<MessageRecord> findBySessionId(Long sessionId) {
            return List.of();
        }

        @Override
        public List<MessageRecord> findRecentByWindowBefore(Long windowId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public List<MessageRecord> findSummaryCandidates(Long windowId, Long afterMessageId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public MessageRecord findEditableById(Long messageId, Long userId) {
            return null;
        }

        @Override
        public int updateContent(Long messageId, Long userId, String content) {
            return 1;
        }

        @Override
        public int invalidateConversationSummary(Long windowId, Long messageId) {
            return 1;
        }

        @Override
        public int softDelete(Long messageId, Long userId) {
            return 1;
        }
    }

    private static class FakeQuestionMapper implements QuestionMapper {
        @Override
        public int insert(QuestionRecord record) {
            return 1;
        }

        @Override
        public List<QuestionRecord> findBySessionId(Long sessionId) {
            return List.of();
        }

        @Override
        public List<QuestionRecord> findByWindowId(Long windowId) {
            return List.of();
        }

        @Override
        public QuestionRecord findActiveById(Long questionId, Long userId) {
            return null;
        }

        @Override
        public int countActiveUserAnswers(Long questionId) {
            return 0;
        }

        @Override
        public int softDelete(Long questionId, Long userId) {
            return 1;
        }
    }

    private static class FakePersonaMapper implements PersonaMapper {
        @Override
        public int insert(PersonaRecord record) {
            return 1;
        }

        @Override
        public List<PersonaRecord> findActive() {
            return List.of();
        }

        @Override
        public List<PersonaRecord> findActiveForUser(Long userId) {
            return findActive();
        }

        @Override
        public PersonaRecord findActiveById(Long id) {
            return PersonaRecord.builder()
                .id(id)
                .name("test")
                .displayName("Test Persona")
                .systemPrompt("Respond as a test persona.")
                .tone("test")
                .active(true)
                .build();
        }

        @Override
        public PersonaRecord findActiveByIdForUser(Long id, Long userId) {
            return findActiveById(id);
        }
    }
}
