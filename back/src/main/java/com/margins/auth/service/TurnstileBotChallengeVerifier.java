package com.margins.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TurnstileBotChallengeVerifier implements BotChallengeVerifier {
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final EmailVerificationAbuseProperties properties;

    @Override
    public void verify(String token, String clientIp) {
        if (!properties.isEnabled()) return;
        if (!StringUtils.hasText(token)) {
            throw new ApiException(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
        }

        EmailVerificationAbuseProperties.Turnstile turnstile = properties.getTurnstile();
        String form = parameter("secret", turnstile.getSecretKey())
            + "&" + parameter("response", token.trim())
            + (StringUtils.hasText(clientIp) ? "&" + parameter("remoteip", clientIp) : "");
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(turnstile.getSiteVerifyUrl()))
            .timeout(Duration.ofSeconds(turnstile.getTimeoutSeconds()))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw unavailable();
            }
            JsonNode payload = objectMapper.readTree(response.body());
            boolean accepted = payload.path("success").asBoolean(false)
                && turnstile.getExpectedAction().equals(payload.path("action").asText())
                && turnstile.getAllowedHostnames().contains(payload.path("hostname").asText());
            if (!accepted) {
                throw new ApiException(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID);
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (IOException | RuntimeException exception) {
            throw unavailable();
        }
    }

    private String parameter(String name, String value) {
        return URLEncoder.encode(name, StandardCharsets.UTF_8)
            + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private ApiException unavailable() {
        return new ApiException(ApiErrorCode.AUTH_BOT_CHALLENGE_UNAVAILABLE);
    }
}
