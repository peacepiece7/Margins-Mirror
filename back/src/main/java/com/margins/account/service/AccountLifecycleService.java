package com.margins.account.service;

import com.margins.account.mapper.AccountMapper;
import com.margins.auth.model.UserRecord;
import com.margins.privacy.mapper.PrivacyRetentionMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@Service
@RequiredArgsConstructor
public class AccountLifecycleService {
    private final AccountMapper accountMapper;
    private final JdbcTemplate jdbc;
    private final Environment environment;
    private final TransactionTemplate transactionTemplate;
    private final PrivacyRetentionMapper privacyRetentionMapper;

    @Scheduled(cron = "0 0 * * * *")
    public void runMaintenance() {
        Instant now = Instant.now();
        for (Long userId : accountMapper.findDuePurgeUserIds(now)) purgeOne(userId, now);
        accountMapper.deleteExpiredChallenges(now.minus(1, ChronoUnit.DAYS));
        aggregateExitSurveys();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void runStartupMaintenance() {
        if (!environment.acceptsProfiles(Profiles.of("test"))) runMaintenance();
    }

    public void purgeOne(Long userId, Instant now) {
        transactionTemplate.executeWithoutResult(status -> purgeOneInTransaction(userId, now));
    }

    private void purgeOneInTransaction(Long userId, Instant now) {
        UserRecord user = accountMapper.findUserById(userId).orElse(null);
        if (user == null || !"RESIGNED".equals(user.getAccountStatus())
            || user.getPersonalDataPurgeScheduledAt().isAfter(now)) return;
        if (user.isEraseActivityOnPurge()) deleteAllActivity(userId);
        accountMapper.deleteOAuthIdentities(userId);
        accountMapper.deleteRefreshTokens(userId);
        privacyRetentionMapper.deleteConsentEventsForUser(userId);
        if (accountMapper.markPurged(userId, now) == 1) {
            accountMapper.insertLifecycleEvent(userId, "PURGED", "SUCCESS", now, null);
        }
    }

    private void deleteAllActivity(Long userId) {
        // Each event is synchronously counted in identifier-free daily aggregates before this purge.
        jdbc.update("DELETE FROM moderation_events WHERE user_id=?", userId);
        jdbc.update("""
            DELETE rc FROM review_comments rc LEFT JOIN session_insights si ON si.id=rc.insight_id
            WHERE rc.user_id=? OR si.user_id=?
            """, userId, userId);
        jdbc.update("DELETE FROM metrics WHERE user_id=?", userId);
        jdbc.update("""
            DELETE drr FROM discussion_run_refinements drr
            JOIN discussion_runs dr ON dr.id=drr.run_id
            WHERE dr.user_id=?
            """, userId);
        jdbc.update("DELETE FROM discussion_runs WHERE user_id=?", userId);
        jdbc.update("""
            DELETE dgi FROM discussion_guide_items dgi
            JOIN discussion_guides dg ON dg.id=dgi.guide_id
            WHERE dg.user_id=?
            """, userId);
        jdbc.update("DELETE FROM discussion_guides WHERE user_id=?", userId);
        jdbc.update("""
            UPDATE messages child
            JOIN messages parent ON parent.id=child.parent_message_id
            SET child.parent_message_id=NULL
            WHERE parent.user_id=?
               OR parent.session_id IN (SELECT id FROM reading_sessions WHERE user_id=?)
            """, userId, userId);
        jdbc.update("DELETE FROM messages WHERE user_id=? OR session_id IN (SELECT id FROM reading_sessions WHERE user_id=?)", userId, userId);
        jdbc.update("UPDATE reflection_interview_answer_revisions SET source_answer_revision_id=NULL WHERE user_id=?", userId);
        jdbc.update("DELETE FROM reflection_interview_answer_revisions WHERE user_id=?", userId);
        jdbc.update("""
            DELETE rs FROM reflection_summaries rs
            JOIN session_insights si ON si.id=rs.reflection_insight_id
            WHERE si.user_id=?
            """, userId);
        jdbc.update("DELETE FROM session_insights WHERE user_id=? AND question_id IS NOT NULL", userId);
        jdbc.update("""
            UPDATE session_windows sw
            JOIN questions q ON q.id=sw.source_question_id
            SET sw.source_question_id=NULL
            WHERE q.user_id=?
            """, userId);
        jdbc.update("DELETE FROM questions WHERE user_id=?", userId);
        jdbc.update("DELETE FROM reflection_interviews WHERE user_id=?", userId);
        jdbc.update("""
            DELETE swp FROM session_window_personas swp
            JOIN session_windows sw ON sw.id=swp.window_id
            WHERE sw.user_id=?
            """, userId);
        jdbc.update("DELETE FROM session_windows WHERE user_id=?", userId);
        jdbc.update("""
            UPDATE reflection_revisions child
            JOIN reflection_revisions parent ON parent.id=child.source_revision_id
            SET child.source_revision_id=NULL
            WHERE parent.user_id=?
            """, userId);
        jdbc.update("DELETE FROM reflection_revisions WHERE user_id=?", userId);
        jdbc.update("DELETE FROM session_highlights WHERE user_id=?", userId);
        jdbc.update("DELETE FROM session_tags WHERE user_id=?", userId);
        jdbc.update("DELETE FROM session_insights WHERE user_id=?", userId);
        jdbc.update("DELETE FROM reading_sessions WHERE user_id=?", userId);
        jdbc.update("DELETE FROM book_candidates WHERE user_id=?", userId);
        jdbc.update("DELETE mc FROM memory_cards mc JOIN memory_card_groups mg ON mg.id=mc.group_id WHERE mg.user_id=?", userId);
        jdbc.update("DELETE FROM memory_card_groups WHERE user_id=?", userId);
        jdbc.update("DELETE FROM books WHERE user_id=?", userId);
    }

    private void aggregateExitSurveys() {
        jdbc.update("""
            INSERT INTO anonymous_exit_survey_monthly_aggregates
              (aggregate_month,reason_code,gender_code,age_band,country_code,response_count)
            SELECT created_month,reason_code,COALESCE(gender_code,''),COALESCE(age_band,''),
              COALESCE(country_code,''),COUNT(*) FROM anonymous_exit_surveys
            GROUP BY created_month,reason_code,COALESCE(gender_code,''),COALESCE(age_band,''),
              COALESCE(country_code,'')
            ON DUPLICATE KEY UPDATE response_count=VALUES(response_count)
            """);
    }
}
