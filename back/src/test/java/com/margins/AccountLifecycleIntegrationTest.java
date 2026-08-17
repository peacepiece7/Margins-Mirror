package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.account.mapper.AccountMapper;
import com.margins.account.service.AccountLifecycleService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class AccountLifecycleIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired AccountMapper accountMapper;
    @Autowired AccountLifecycleService lifecycleService;
    @Autowired JdbcTemplate jdbc;

    @Test
    void restoreClearsLifecycleAndPurgeKeepsActivityByDefault() {
        Long userId = insertUser("restore");
        Instant now = Instant.now();
        assertThat(accountMapper.resign(userId, now, now.plus(30, ChronoUnit.DAYS))).isOne();
        assertThat(accountMapper.restore(userId, now.plusSeconds(1))).isOne();
        assertThat(accountMapper.findUserById(userId).orElseThrow().getAccountStatus()).isEqualTo("ACTIVE");

        jdbc.update("INSERT INTO books(user_id,title,source,is_test_data) VALUES(?,?,'integration',TRUE)",
            userId, "preserved activity");
        jdbc.update("""
            INSERT INTO user_oauth_identities(user_id,provider,provider_subject)
            VALUES(?,'google',?)
            """, userId, UUID.randomUUID().toString());
        jdbc.update("""
            INSERT INTO user_consent_events
              (user_id,consent_type,document_version,event_type,registration_channel,is_test_data)
            VALUES(?,'PRIVACY_POLICY','2026-07-27','GRANTED','TEST',TRUE)
            """, userId);
        jdbc.update("""
            UPDATE users SET account_status='RESIGNED',resigned_at=?,
              personal_data_purge_scheduled_at=?,erase_activity_on_purge=FALSE WHERE id=?
            """, now.minus(31, ChronoUnit.DAYS), now.minusSeconds(1), userId);

        lifecycleService.purgeOne(userId, now);

        var purged = accountMapper.findUserById(userId).orElseThrow();
        assertThat(purged.getAccountStatus()).isEqualTo("PURGED");
        assertThat(purged.getUsername()).isEqualTo("deleted_" + userId);
        assertThat(purged.getEmail()).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM books WHERE user_id=?", Integer.class, userId)).isOne();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_oauth_identities WHERE user_id=?", Integer.class, userId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_consent_events WHERE user_id=?", Integer.class, userId)).isZero();
    }

    @Test
    void eraseReservationDeletesActivity() {
        Long userId = insertUser("erase");
        Instant now = Instant.now();
        jdbc.update("INSERT INTO books(user_id,title,source,is_test_data) VALUES(?,?,'integration',TRUE)",
            userId, "erased activity");
        jdbc.update("""
            UPDATE users SET account_status='RESIGNED',resigned_at=?,
              personal_data_purge_scheduled_at=?,erase_activity_on_purge=TRUE WHERE id=?
            """, now.minus(31, ChronoUnit.DAYS), now.minusSeconds(1), userId);

        lifecycleService.purgeOne(userId, now);

        assertThat(accountMapper.findUserById(userId)).isPresent()
            .get().extracting(value -> value.getAccountStatus()).isEqualTo("PURGED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM books WHERE user_id=?", Integer.class, userId)).isZero();
    }

    @Test
    void restoreAtExactPurgeBoundaryIsRejected() {
        Long userId = insertUser("boundary");
        Instant boundary = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        jdbc.update("""
            UPDATE users SET account_status='RESIGNED',resigned_at=?,
              personal_data_purge_scheduled_at=? WHERE id=?
            """, boundary.minus(30, ChronoUnit.DAYS), boundary, userId);

        assertThat(accountMapper.restore(userId, boundary)).isZero();
    }

    private Long insertUser(String prefix) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO users(username,display_name,email,email_verified,password_hash,auth_provider,is_test_data)
            VALUES(?,?,?,TRUE,'hash','local',TRUE)
            """, prefix + suffix, prefix, prefix + suffix + "@example.com");
        return jdbc.queryForObject("SELECT id FROM users WHERE username=?", Long.class, prefix + suffix);
    }
}
