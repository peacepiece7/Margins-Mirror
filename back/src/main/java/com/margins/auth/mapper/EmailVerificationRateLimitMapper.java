package com.margins.auth.mapper;

import com.margins.auth.model.EmailVerificationRateLimitRecord;
import java.time.Instant;
import java.util.Optional;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface EmailVerificationRateLimitMapper {
    @Insert("""
        INSERT INTO auth_email_verification_rate_limits (
          scope_type, scope_hash, retention_after, is_test_data
        ) VALUES (
          #{scopeType}, #{scopeHash}, #{retentionAfter}, #{testData}
        )
        ON DUPLICATE KEY UPDATE scope_hash = #{scopeHash}
        """)
    int insertIfMissing(
        @Param("scopeType") String scopeType,
        @Param("scopeHash") String scopeHash,
        @Param("retentionAfter") Instant retentionAfter,
        @Param("testData") boolean testData
    );

    @Select("""
        SELECT scope_type, scope_hash,
               minute_window_started_at, minute_count,
               hour_window_started_at, hour_count,
               day_window_started_at, day_count,
               retention_after, is_test_data
        FROM auth_email_verification_rate_limits
        WHERE scope_type = #{scopeType} AND scope_hash = #{scopeHash}
        """)
    Optional<EmailVerificationRateLimitRecord> find(
        @Param("scopeType") String scopeType,
        @Param("scopeHash") String scopeHash
    );

    @Select("""
        SELECT scope_type, scope_hash,
               minute_window_started_at, minute_count,
               hour_window_started_at, hour_count,
               day_window_started_at, day_count,
               retention_after, is_test_data
        FROM auth_email_verification_rate_limits
        WHERE scope_type = #{scopeType} AND scope_hash = #{scopeHash}
        FOR UPDATE
        """)
    EmailVerificationRateLimitRecord findForUpdate(
        @Param("scopeType") String scopeType,
        @Param("scopeHash") String scopeHash
    );

    @Update("""
        UPDATE auth_email_verification_rate_limits
        SET minute_window_started_at = #{minuteWindowStartedAt},
            minute_count = #{minuteCount},
            hour_window_started_at = #{hourWindowStartedAt},
            hour_count = #{hourCount},
            day_window_started_at = #{dayWindowStartedAt},
            day_count = #{dayCount},
            retention_after = #{retentionAfter},
            updated_at = CURRENT_TIMESTAMP
        WHERE scope_type = #{scopeType} AND scope_hash = #{scopeHash}
        """)
    int update(EmailVerificationRateLimitRecord record);
}
