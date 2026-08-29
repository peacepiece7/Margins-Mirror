package com.margins.account.mapper;

import com.margins.account.model.AccountChallengeRecord;
import com.margins.auth.model.UserRecord;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AccountMapper {
    String USER_COLUMNS = """
        id, username, display_name AS displayName, email, email_verified AS emailVerified,
        preferred_locale AS preferredLocale,
        password_hash AS passwordHash, auth_provider AS authProvider,
        account_status AS accountStatus, resigned_at AS resignedAt,
        personal_data_purge_scheduled_at AS personalDataPurgeScheduledAt,
        personal_data_purged_at AS personalDataPurgedAt, credentials_version AS credentialsVersion,
        erase_activity_on_purge AS eraseActivityOnPurge, failed_login_count AS failedLoginCount,
        locked_until AS lockedUntil, last_login_at AS lastLoginAt, is_test_data AS testData
        """;

    @Select("SELECT " + USER_COLUMNS + " FROM users WHERE id=#{userId} LIMIT 1")
    Optional<UserRecord> findUserById(Long userId);

    @Select("SELECT " + USER_COLUMNS + " FROM users WHERE email=#{email} LIMIT 1")
    Optional<UserRecord> findUserByEmail(String email);

    @Update("""
        UPDATE users
        SET display_name=#{displayName},
            preferred_locale=COALESCE(#{preferredLocale}, preferred_locale),
            updated_at=CURRENT_TIMESTAMP
        WHERE id=#{userId} AND account_status='ACTIVE'
        """)
    int updateProfile(@Param("userId") Long userId, @Param("displayName") String displayName,
        @Param("preferredLocale") String preferredLocale);

    @Update("""
        UPDATE users SET password_hash=#{passwordHash}, credentials_version=credentials_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=#{userId} AND account_status='ACTIVE'
        """)
    int updatePassword(@Param("userId") Long userId, @Param("passwordHash") String passwordHash);

    @Update("""
        UPDATE users SET account_status='RESIGNED', resigned_at=#{now},
          personal_data_purge_scheduled_at=#{purgeAt}, personal_data_purged_at=NULL,
          erase_activity_on_purge=FALSE, credentials_version=credentials_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=#{userId} AND account_status='ACTIVE'
        """)
    int resign(@Param("userId") Long userId, @Param("now") Instant now, @Param("purgeAt") Instant purgeAt);

    @Update("""
        UPDATE users SET account_status='ACTIVE', resigned_at=NULL,
          personal_data_purge_scheduled_at=NULL, personal_data_purged_at=NULL,
          erase_activity_on_purge=FALSE, credentials_version=credentials_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=#{userId} AND account_status='RESIGNED'
          AND personal_data_purge_scheduled_at > #{now}
        """)
    int restore(@Param("userId") Long userId, @Param("now") Instant now);

    @Update("""
        UPDATE users SET erase_activity_on_purge=TRUE, updated_at=CURRENT_TIMESTAMP
        WHERE id=#{userId} AND account_status='RESIGNED'
          AND personal_data_purge_scheduled_at > #{now}
        """)
    int scheduleActivityErase(@Param("userId") Long userId, @Param("now") Instant now);

    @Select("""
        SELECT id FROM users WHERE account_status='RESIGNED'
          AND personal_data_purge_scheduled_at <= #{now} ORDER BY id LIMIT 100
        """)
    List<Long> findDuePurgeUserIds(Instant now);

    @Update("""
        UPDATE users SET username=CONCAT('deleted_', id), display_name='탈퇴한 회원',
          email=NULL, email_verified=FALSE, password_hash=NULL,
          auth_provider='resigned', failed_login_count=0, locked_until=NULL, last_login_at=NULL,
          account_status='PURGED', personal_data_purged_at=#{now}, credentials_version=credentials_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=#{userId} AND account_status='RESIGNED'
          AND personal_data_purge_scheduled_at <= #{now}
        """)
    int markPurged(@Param("userId") Long userId, @Param("now") Instant now);

    @Insert("""
        INSERT INTO account_email_challenges
          (id,user_id,purpose,email,code_hmac,expires_at,request_ip_hash)
        VALUES (#{id},#{userId},#{purpose},#{email},#{codeHmac},#{expiresAt},#{requestIpHash})
        """)
    int insertChallenge(AccountChallengeRecord record);

    @Select("""
        SELECT id,user_id AS userId,purpose,email,code_hmac AS codeHmac,
          failed_attempts AS failedAttempts,expires_at AS expiresAt,verified_at AS verifiedAt,
          used_at AS usedAt,action_token_hash AS actionTokenHash,
          action_token_expires_at AS actionTokenExpiresAt,request_ip_hash AS requestIpHash,
          created_at AS createdAt FROM account_email_challenges WHERE id=#{id} LIMIT 1
        """)
    Optional<AccountChallengeRecord> findChallenge(String id);

    @Select("SELECT COUNT(*) FROM account_email_challenges WHERE user_id=#{userId} AND created_at >= #{since}")
    int countUserChallenges(@Param("userId") Long userId, @Param("since") Instant since);

    @Select("SELECT COUNT(*) FROM account_email_challenges WHERE request_ip_hash=#{ipHash} AND created_at >= #{since}")
    int countIpChallenges(@Param("ipHash") String ipHash, @Param("since") Instant since);

    @Select("SELECT MAX(created_at) FROM account_email_challenges WHERE user_id=#{userId} AND purpose=#{purpose}")
    Instant lastChallengeAt(@Param("userId") Long userId, @Param("purpose") String purpose);

    @Update("UPDATE account_email_challenges SET failed_attempts=failed_attempts+1 WHERE id=#{id}")
    int incrementChallengeFailure(String id);

    @Update("""
        UPDATE account_email_challenges SET verified_at=#{now},action_token_hash=#{tokenHash},
          action_token_expires_at=#{tokenExpiresAt}
        WHERE id=#{id} AND verified_at IS NULL AND used_at IS NULL
        """)
    int verifyChallenge(@Param("id") String id, @Param("now") Instant now,
        @Param("tokenHash") String tokenHash, @Param("tokenExpiresAt") Instant tokenExpiresAt);

    @Update("""
        UPDATE account_email_challenges SET used_at=#{now}
        WHERE action_token_hash=#{tokenHash} AND purpose=#{purpose} AND user_id=#{userId}
          AND verified_at IS NOT NULL AND used_at IS NULL AND action_token_expires_at > #{now}
        """)
    int consumeActionToken(@Param("tokenHash") String tokenHash, @Param("purpose") String purpose,
        @Param("userId") Long userId, @Param("now") Instant now);

    @Delete("DELETE FROM refresh_tokens WHERE user_id=#{userId}")
    int deleteRefreshTokens(Long userId);

    @Delete("DELETE FROM user_oauth_identities WHERE user_id=#{userId}")
    int deleteOAuthIdentities(Long userId);

    @Insert("""
        INSERT INTO account_lifecycle_events(user_id,transition_type,result,processed_at,purge_after)
        VALUES(#{userId},#{type},#{result},#{now},#{purgeAfter})
        """)
    int insertLifecycleEvent(@Param("userId") Long userId, @Param("type") String type,
        @Param("result") String result, @Param("now") Instant now, @Param("purgeAfter") Instant purgeAfter);

    @Delete("DELETE FROM account_email_challenges WHERE expires_at < #{before}")
    int deleteExpiredChallenges(Instant before);

    @Delete("DELETE FROM account_lifecycle_events WHERE processed_at < #{before}")
    int deleteOldLifecycleEvents(Instant before);

    @Delete("DELETE FROM anonymous_exit_surveys WHERE created_at < #{before}")
    int deleteOldSurveys(Instant before);

    @Insert("""
        INSERT INTO anonymous_exit_surveys(reason_code,gender_code,gender_text,age_band,country_code,
          region,other_text,is_test_data,created_month)
        VALUES(#{reason},#{gender},#{genderText},#{ageBand},#{countryCode},#{region},#{otherText},
          #{testData},DATE_FORMAT(CURRENT_DATE,'%Y-%m-01'))
        """)
    int insertExitSurvey(@Param("reason") String reason, @Param("gender") String gender,
        @Param("genderText") String genderText, @Param("ageBand") String ageBand,
        @Param("countryCode") String countryCode, @Param("region") String region,
        @Param("otherText") String otherText, @Param("testData") boolean testData);
}
