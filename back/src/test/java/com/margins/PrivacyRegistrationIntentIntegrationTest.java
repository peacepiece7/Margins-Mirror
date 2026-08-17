package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.privacy.business.PrivacyConsentBusiness;
import com.margins.privacy.mapper.PrivacyConsentMapper;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class PrivacyRegistrationIntentIntegrationTest extends AbstractMySqlIntegrationTest {

    private static final String STALE_VERSION_TOKEN_HASH = "a".repeat(64);
    private static final String CURRENT_VERSION_TOKEN_HASH = "b".repeat(64);

    @Autowired
    private PrivacyConsentMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void resetRegistrationIntents() {
        jdbc.update("DELETE FROM pending_registration_intents");
    }

    @Test
    void consumesOnlyAnIntentForTheCurrentRequiredPolicyVersions() {
        Instant expiresAt = Instant.now().plus(10, ChronoUnit.MINUTES);
        mapper.insertRegistrationIntent(
            STALE_VERSION_TOKEN_HASH,
            "2026-01-01",
            PrivacyConsentBusiness.CURRENT_VERSION,
            expiresAt,
            true
        );
        mapper.insertRegistrationIntent(
            CURRENT_VERSION_TOKEN_HASH,
            PrivacyConsentBusiness.CURRENT_VERSION,
            PrivacyConsentBusiness.CURRENT_VERSION,
            expiresAt,
            true
        );

        assertThat(mapper.consumeRegistrationIntent(
            STALE_VERSION_TOKEN_HASH,
            PrivacyConsentBusiness.CURRENT_VERSION,
            PrivacyConsentBusiness.CURRENT_VERSION
        )).isZero();
        assertThat(mapper.consumeRegistrationIntent(
            CURRENT_VERSION_TOKEN_HASH,
            PrivacyConsentBusiness.CURRENT_VERSION,
            PrivacyConsentBusiness.CURRENT_VERSION
        )).isEqualTo(1);
        assertThat(mapper.consumeRegistrationIntent(
            CURRENT_VERSION_TOKEN_HASH,
            PrivacyConsentBusiness.CURRENT_VERSION,
            PrivacyConsentBusiness.CURRENT_VERSION
        )).isZero();
    }
}
