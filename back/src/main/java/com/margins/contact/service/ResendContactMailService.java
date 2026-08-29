package com.margins.contact.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.config.ResendProperties;
import com.margins.contact.config.ContactProperties;
import com.margins.contact.model.ContactInquiry;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 공개 문의를 고정된 운영자 주소로 전달하는 Resend transport 서비스다.
 * 사용자 입력은 plain-text 본문에만 넣고 provider 응답을 bounded 상태로 변환한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ResendContactMailService {
    private static final String USER_AGENT = "Margins/1.0";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final ContactProperties contactProperties;
    private final MailVerificationProperties mailProperties;
    private final ResendProperties resendProperties;

    @PostConstruct
    public void validateStartupConfiguration() {
        if (!contactProperties.isEnabled()) return;
        if (!StringUtils.hasText(resendProperties.getApiKey()) || !StringUtils.hasText(mailProperties.getFrom())) {
            throw new IllegalStateException("Resend sender and API key are required when contact inquiries are enabled");
        }
        if (!StringUtils.hasText(resendProperties.getBaseUrl()) || resendProperties.getTimeoutSeconds() <= 0) {
            throw new IllegalStateException("Resend mail configuration is invalid");
        }
    }

    public String send(ContactInquiry inquiry) {
        String text = "Inquiry ID: " + inquiry.getId()
            + "\nCategory: " + inquiry.getCategory()
            + "\nEmail: " + inquiry.getEmail()
            + "\nSubject: " + inquiry.getSubject()
            + "\n\n" + inquiry.getMessage();
        try {
            String body = objectMapper.writeValueAsString(new ResendRequest(
                mailProperties.getFrom(), List.of(contactProperties.getRecipient()),
                "New Margins contact inquiry #" + inquiry.getId(), text));
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(resendProperties.getBaseUrl().replaceAll("/$", "") + "/emails"))
                .timeout(Duration.ofSeconds(resendProperties.getTimeoutSeconds()))
                .header("Authorization", "Bearer " + resendProperties.getApiKey())
                .header("Content-Type", "application/json")
                .header("Idempotency-Key", "contact-inquiry-" + inquiry.getId())
                .header("User-Agent", USER_AGENT)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ContactDeliveryException("PROVIDER_REJECTED");
            }
            JsonNode payload = objectMapper.readTree(response.body());
            if (!payload.path("id").isTextual()
                || !payload.path("id").asText().matches("[A-Za-z0-9_-]{1,128}")) {
                throw new ContactDeliveryException("INVALID_RESPONSE");
            }
            String providerMessageId = payload.path("id").asText();
            log.info("Contact inquiry email accepted inquiryId={} providerMessageId={}",
                inquiry.getId(), providerMessageId);
            return providerMessageId;
        } catch (ContactDeliveryException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ContactDeliveryException("TIMEOUT", exception);
        } catch (HttpTimeoutException exception) {
            throw new ContactDeliveryException("TIMEOUT", exception);
        } catch (IOException exception) {
            throw new ContactDeliveryException("UNAVAILABLE", exception);
        } catch (RuntimeException exception) {
            throw new ContactDeliveryException("UNAVAILABLE", exception);
        }
    }

    private record ResendRequest(String from, List<String> to, String subject, String text) { }
}
