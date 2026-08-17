package com.margins.privacy.mapper;

import java.time.Instant;
import java.time.LocalDate;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PrivacyRetentionMapper {

    @Delete("""
        DELETE FROM pending_registration_intents
        WHERE COALESCE(used_at, expires_at) <= #{cutoff}
        """)
    int deleteRegistrationIntentsDue(Instant cutoff);

    @Delete("""
        DELETE FROM pending_google_registrations
        WHERE COALESCE(used_at, expires_at) <= #{cutoff}
        """)
    int deleteGoogleRegistrationsDue(Instant cutoff);

    @Delete("""
        DELETE FROM auth_email_verifications
        WHERE expires_at <= #{cutoff}
          AND (used_at IS NULL OR used_at <= #{cutoff})
          AND (confirmed_at IS NULL OR confirmed_at <= #{cutoff})
        """)
    int deleteEmailVerificationsDue(Instant cutoff);

    @Delete("""
        DELETE FROM auth_email_verification_rate_limits
        WHERE retention_after <= #{now}
        """)
    int deleteEmailVerificationRateLimitsDue(Instant now);

    @Delete("""
        DELETE FROM refresh_tokens
        WHERE COALESCE(revoked_at, expires_at) <= #{cutoff}
        """)
    int deleteRefreshTokensDue(Instant cutoff);

    @Update("""
        UPDATE users
        SET failed_login_count = 0, locked_until = NULL
        WHERE locked_until IS NOT NULL AND locked_until <= #{cutoff}
        """)
    int clearReleasedLoginLocksDue(Instant cutoff);

    @Delete("DELETE FROM account_lifecycle_events WHERE processed_at <= #{cutoff}")
    int deleteLifecycleEventsDue(Instant cutoff);

    @Delete("DELETE FROM anonymous_exit_surveys WHERE created_at <= #{cutoff}")
    int deleteExitSurveysDue(Instant cutoff);

    @Delete("DELETE FROM anonymous_exit_survey_monthly_aggregates WHERE aggregate_month <= #{cutoff}")
    int deleteExitSurveyAggregatesDue(LocalDate cutoff);

    @Delete("DELETE FROM user_consent_events WHERE user_id = #{userId}")
    int deleteConsentEventsForUser(@Param("userId") Long userId);
}
