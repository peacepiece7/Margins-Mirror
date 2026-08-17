package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.testsupport.AbstractMySqlIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class PrivacySchemaIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void finalSchemaHasConsentTablesAndNoPhoneColumnOrUniqueIndex() {
        Integer phoneColumns = jdbc.queryForObject("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='phone_number'
            """, Integer.class);
        Integer phoneIndexes = jdbc.queryForObject("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uk_users_phone_number'
            """, Integer.class);
        Integer privacyTables = jdbc.queryForObject("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA=DATABASE()
              AND TABLE_NAME IN (
                'user_consent_events',
                'pending_registration_intents',
                'pending_google_registrations'
              )
            """, Integer.class);

        assertThat(phoneColumns).isZero();
        assertThat(phoneIndexes).isZero();
        assertThat(privacyTables).isEqualTo(3);
    }
}
