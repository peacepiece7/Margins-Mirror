package com.margins.contact.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.contact.config.ContactProperties;
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

/** 공개 문의 전용 Turnstile action과 trusted hostname을 검증하는 서비스다. */
@Service
@RequiredArgsConstructor
public class ContactBotChallengeVerifier {
    static final String EXPECTED_ACTION = "contact_inquiry";
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final ContactProperties properties;

    public void verify(String token, String clientIp) {
        if (!properties.isEnabled()) throw new ApiException(ApiErrorCode.CONTACT_INQUIRY_UNAVAILABLE);
        if (!StringUtils.hasText(token)) throw invalid();
        ContactProperties.Turnstile turnstile = properties.getTurnstile();
        String form = parameter("secret", turnstile.getSecretKey())
            + "&" + parameter("response", token.trim())
            + (StringUtils.hasText(clientIp) ? "&" + parameter("remoteip", clientIp) : "");
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(turnstile.getSiteVerifyUrl()))
                .timeout(Duration.ofSeconds(turnstile.getTimeoutSeconds()))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) throw unavailable();
            JsonNode payload = objectMapper.readTree(response.body());
            if (!payload.path("success").asBoolean(false)
                || !EXPECTED_ACTION.equals(payload.path("action").asText())
                || !turnstile.getAllowedHostnames().contains(payload.path("hostname").asText())) {
                throw invalid();
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
    private ApiException invalid() {
        return new ApiException(ApiErrorCode.CONTACT_INQUIRY_BOT_CHALLENGE_INVALID);
    }
    private ApiException unavailable() {
        return new ApiException(ApiErrorCode.CONTACT_INQUIRY_BOT_CHALLENGE_UNAVAILABLE);
    }
}
