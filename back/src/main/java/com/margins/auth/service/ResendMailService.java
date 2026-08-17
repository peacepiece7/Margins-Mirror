package com.margins.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.config.ResendProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** Resend REST API로 인증 메일을 발송한다. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "margins.mail.verification", name = "enabled", havingValue = "true")
public class ResendMailService implements MailService {

    private static final String SUBJECT = "Margins 회원가입 인증";
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final MailVerificationProperties mailProperties;
    private final ResendProperties resendProperties;

    @jakarta.annotation.PostConstruct
    public void validateStartupConfiguration() {
        if (!StringUtils.hasText(resendProperties.getApiKey())) {
            throw new IllegalStateException("RESEND_API_KEY is required when email verification is enabled");
        }
        if (!StringUtils.hasText(mailProperties.getFrom())) {
            throw new IllegalStateException("MARGINS_MAIL_FROM is required when email verification is enabled");
        }
        if (!StringUtils.hasText(resendProperties.getBaseUrl()) || resendProperties.getTimeoutSeconds() <= 0) {
            throw new IllegalStateException("Resend mail configuration is invalid");
        }
    }

    @Override
    public void sendVerificationCode(String email, String code, int expiresInSeconds) {
        String expiry = expiresInSeconds % 60 == 0
            ? (expiresInSeconds / 60) + "분" : expiresInSeconds + "초";
        String text = "Margins 회원가입 인증번호입니다.\n인증번호: " + code
            + "\n이 인증번호는 " + expiry + " 동안 사용할 수 있습니다.";
        String html = "<h2>Margins</h2><p>회원가입 인증번호입니다.</p>"
            + "<h1 style=\"letter-spacing: 4px;\">" + code + "</h1>"
            + "<p>이 인증번호는 " + expiry + " 동안 사용할 수 있습니다.</p>";
        try {
            String body = objectMapper.writeValueAsString(
                new ResendRequest(mailProperties.getFrom(), List.of(email), SUBJECT, html, text));
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(resendProperties.getBaseUrl().replaceAll("/$", "") + "/emails"))
                .timeout(Duration.ofSeconds(resendProperties.getTimeoutSeconds()))
                .header("Authorization", "Bearer " + resendProperties.getApiKey())
                .header("Content-Type", "application/json")
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new MailDeliveryException("verification email provider rejected the request");
            }
            JsonNode responseJson = objectMapper.readTree(response.body());
            if (!responseJson.path("id").isTextual() || responseJson.path("id").asText().isBlank()) {
                throw new MailDeliveryException("verification email provider returned an invalid response");
            }
            org.slf4j.LoggerFactory.getLogger(ResendMailService.class)
                .info("Verification email accepted by Resend: emailId={}", responseJson.get("id").asText());
        } catch (MailDeliveryException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new MailDeliveryException("verification email could not be sent", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new MailDeliveryException("verification email could not be sent", exception);
        } catch (RuntimeException exception) {
            throw new MailDeliveryException("verification email could not be sent", exception);
        }
    }

    private record ResendRequest(String from, List<String> to, String subject, String html, String text) { }
}
