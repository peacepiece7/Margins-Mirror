package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.privacy.service.PrivacyRetentionService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class PrivacyRetentionIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired PrivacyRetentionService retentionService;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void resetRetentionFixtures() {
        jdbc.update("DELETE FROM pending_registration_intents");
        jdbc.update("DELETE FROM pending_google_registrations");
        jdbc.update("DELETE FROM auth_email_verifications");
        jdbc.update("DELETE FROM auth_email_verification_rate_limits");
        jdbc.update("DELETE FROM contact_inquiries");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM account_lifecycle_events");
        jdbc.update("DELETE FROM anonymous_exit_surveys");
        jdbc.update("DELETE FROM anonymous_exit_survey_monthly_aggregates");
    }

    @Test
    void deletesRecordsAtBoundaryAndPreservesRecordsImmediatelyBeforeIt() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Long userId = insertUser("retention");
        insertRegistrationIntent("due-intent", now.minus(1, ChronoUnit.DAYS));
        insertRegistrationIntent("future-intent", now.minus(1, ChronoUnit.DAYS).plusSeconds(1));
        insertGooglePending("due-google", "due-subject", now.minus(1, ChronoUnit.DAYS));
        insertGooglePending("future-google", "future-subject", now.minus(1, ChronoUnit.DAYS).plusSeconds(1));
        insertEmailVerification("due@example.com", now.minus(1, ChronoUnit.DAYS));
        insertEmailVerification("future@example.com", now.minus(1, ChronoUnit.DAYS).plusSeconds(1));
        insertEmailRateLimit("due-rate", now);
        insertEmailRateLimit("future-rate", now.plusSeconds(1));
        insertContactInquiry("due-contact@example.com", now);
        insertContactInquiry("future-contact@example.com", now.plusSeconds(1));
        insertRefreshToken(userId, "due-refresh", now.minus(7, ChronoUnit.DAYS));
        insertRefreshToken(userId, "future-refresh", now.minus(7, ChronoUnit.DAYS).plusSeconds(1));
        jdbc.update("UPDATE users SET failed_login_count=3, locked_until=? WHERE id=?",
            now.minus(7, ChronoUnit.DAYS), userId);
        insertLifecycleEvent(userId, now.minus(365, ChronoUnit.DAYS));
        insertLifecycleEvent(userId, now.minus(365, ChronoUnit.DAYS).plusSeconds(1));
        insertExitSurvey(now.minus(365, ChronoUnit.DAYS));
        insertExitSurvey(now.minus(365, ChronoUnit.DAYS).plusSeconds(1));
        insertExitSurveyAggregate(LocalDate.ofInstant(now, java.time.ZoneOffset.UTC).minusYears(3));
        insertExitSurveyAggregate(LocalDate.ofInstant(now, java.time.ZoneOffset.UTC).minusYears(3).plusDays(1));

        var result = retentionService.runMaintenanceAt(now);

        assertThat(result.registrationIntents()).isEqualTo(1);
        assertThat(result.googleRegistrations()).isEqualTo(1);
        assertThat(result.emailVerifications()).isEqualTo(1);
        assertThat(result.emailVerificationRateLimits()).isEqualTo(1);
        assertThat(result.contactInquiries()).isEqualTo(1);
        assertThat(result.refreshTokens()).isEqualTo(1);
        assertThat(result.releasedLoginLocks()).isEqualTo(1);
        assertThat(result.lifecycleEvents()).isEqualTo(1);
        assertThat(result.exitSurveys()).isEqualTo(1);
        assertThat(result.exitSurveyAggregates()).isEqualTo(1);
        assertThat(count("pending_registration_intents")).isEqualTo(1);
        assertThat(count("pending_google_registrations")).isEqualTo(1);
        assertThat(count("auth_email_verifications")).isEqualTo(1);
        assertThat(count("auth_email_verification_rate_limits")).isEqualTo(1);
        assertThat(count("contact_inquiries")).isEqualTo(1);
        assertThat(count("refresh_tokens")).isEqualTo(1);
        assertThat(count("account_lifecycle_events")).isEqualTo(1);
        assertThat(count("anonymous_exit_surveys")).isEqualTo(1);
        assertThat(count("anonymous_exit_survey_monthly_aggregates")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT locked_until FROM users WHERE id=?", Instant.class, userId)).isNull();
    }

    private Long insertUser(String prefix) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO users(username,display_name,email,email_verified,password_hash,auth_provider,is_test_data)
            VALUES(?,?,?,TRUE,'hash','local',TRUE)
            """, prefix + suffix, prefix, prefix + suffix + "@example.com");
        return jdbc.queryForObject("SELECT id FROM users WHERE username=?", Long.class, prefix + suffix);
    }

    private void insertRegistrationIntent(String token, Instant expiresAt) {
        jdbc.update("""
            INSERT INTO pending_registration_intents
              (token_hash,privacy_policy_version,ai_transfer_version,expires_at,is_test_data)
            VALUES(SHA2(?,256),'2026-07-27','2026-07-27',?,TRUE)
            """, token, expiresAt);
    }

    private void insertGooglePending(String token, String subject, Instant expiresAt) {
        jdbc.update("""
            INSERT INTO pending_google_registrations
              (token_hash,provider_subject,email,email_verified,expires_at,is_test_data)
            VALUES(SHA2(?,256),?,CONCAT(?, '@example.com'),TRUE,?,TRUE)
            """, token, subject, subject, expiresAt);
    }

    private void insertEmailVerification(String email, Instant expiresAt) {
        jdbc.update("""
            INSERT INTO auth_email_verifications(email,code_hash,expires_at,is_test_data)
            VALUES(?,SHA2(?,256),?,TRUE)
            """, email, email, expiresAt);
    }

    private void insertEmailRateLimit(String hashSeed, Instant retentionAfter) {
        jdbc.update("""
            INSERT INTO auth_email_verification_rate_limits
              (scope_type,scope_hash,retention_after,is_test_data)
            VALUES('EMAIL',SHA2(?,256),?,TRUE)
            """, hashSeed, retentionAfter);
    }

    private void insertContactInquiry(String email, Instant deleteAfter) {
        jdbc.update("""
            INSERT INTO contact_inquiries
              (email,category,subject,message,status,delete_after,is_test_data,created_at)
            VALUES(?,'OTHER','Retention test','Retention test','PENDING_DELIVERY',?,TRUE,?)
            """, email, deleteAfter, deleteAfter.minus(365, ChronoUnit.DAYS));
    }

    private void insertRefreshToken(Long userId, String token, Instant expiresAt) {
        jdbc.update("""
            INSERT INTO refresh_tokens(user_id,token_hash,jti,expires_at)
            VALUES(?,SHA2(?,256),?,?)
            """, userId, token, token, expiresAt);
    }

    private void insertLifecycleEvent(Long userId, Instant processedAt) {
        jdbc.update("""
            INSERT INTO account_lifecycle_events(user_id,transition_type,result,processed_at)
            VALUES(?,'RETENTION_TEST','SUCCESS',?)
            """, userId, processedAt);
    }

    private void insertExitSurvey(Instant createdAt) {
        jdbc.update("""
            INSERT INTO anonymous_exit_surveys
              (reason_code,is_test_data,created_month,created_at)
            VALUES('retention_test',TRUE,?,?)
            """, LocalDate.ofInstant(createdAt, java.time.ZoneOffset.UTC).withDayOfMonth(1), createdAt);
    }

    private void insertExitSurveyAggregate(LocalDate month) {
        jdbc.update("""
            INSERT INTO anonymous_exit_survey_monthly_aggregates
              (aggregate_month,reason_code,gender_code,age_band,country_code,response_count)
            VALUES(?,'retention_test','','','',1)
            """, month);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }
}
