package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.contact.business.ContactBusiness;
import com.margins.contact.config.ContactProperties;
import com.margins.contact.dto.ContactInquiryRequest;
import com.margins.contact.service.ContactBotChallengeVerifier;
import com.margins.contact.service.ContactDeliveryException;
import com.margins.contact.service.ResendContactMailService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

class ContactInquiryIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired ContactBusiness business;
    @Autowired ContactProperties properties;
    @Autowired JdbcTemplate jdbc;
    @MockBean ContactBotChallengeVerifier verifier;
    @MockBean ResendContactMailService mailService;

    @BeforeEach
    void setUp() {
        properties.setEnabled(true);
        jdbc.update("DELETE FROM contact_inquiries");
        reset(verifier, mailService);
    }

    @AfterEach
    void tearDown() {
        properties.setEnabled(false);
        jdbc.update("DELETE FROM contact_inquiries");
    }

    @Test
    void persistsProviderAcceptanceAsOpenWithTheReturnedTimestamp() {
        when(mailService.send(any())).thenReturn("provider-contact-1");

        var response = business.submit(request(), "203.0.113.4");
        Map<String, Object> stored = jdbc.queryForMap("""
            SELECT status, provider_message_id, delivery_failure_code, created_at, delete_after, is_test_data
            FROM contact_inquiries WHERE id=?
            """, response.inquiryId());

        assertThat(response.status()).isEqualTo("OPEN");
        assertThat(stored.get("status")).isEqualTo("OPEN");
        assertThat(stored.get("provider_message_id")).isEqualTo("provider-contact-1");
        assertThat(stored.get("delivery_failure_code")).isNull();
        assertThat(jdbc.queryForObject(
            "SELECT created_at FROM contact_inquiries WHERE id=?", Instant.class, response.inquiryId()))
            .isEqualTo(response.createdAt());
        assertThat((Boolean) stored.get("is_test_data")).isTrue();
    }

    @Test
    void preservesProviderFailureAsDeliveryFailedBeforeReturningError() {
        when(mailService.send(any())).thenThrow(new ContactDeliveryException("TIMEOUT"));

        assertThatThrownBy(() -> business.submit(request(), "203.0.113.4"))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(ApiErrorCode.CONTACT_INQUIRY_DELIVERY_FAILED));

        Map<String, Object> stored = jdbc.queryForMap("""
            SELECT status, provider_message_id, delivery_failure_code
            FROM contact_inquiries
            """);
        assertThat(stored.get("status")).isEqualTo("DELIVERY_FAILED");
        assertThat(stored.get("provider_message_id")).isNull();
        assertThat(stored.get("delivery_failure_code")).isEqualTo("TIMEOUT");
    }

    private ContactInquiryRequest request() {
        return new ContactInquiryRequest(
            "reader@example.com", "OTHER", "Integration inquiry", "Please help.", "challenge");
    }
}
