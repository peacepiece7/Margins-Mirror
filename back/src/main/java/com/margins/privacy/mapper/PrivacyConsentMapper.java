package com.margins.privacy.mapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PrivacyConsentMapper {

    @Select("""
        SELECT consent_type AS consentType, document_version AS documentVersion, event_type AS eventType
        FROM user_consent_events e
        WHERE user_id = #{userId}
          AND id = (
            SELECT MAX(e2.id) FROM user_consent_events e2
            WHERE e2.user_id = e.user_id AND e2.consent_type = e.consent_type
          )
        """)
    List<Map<String, Object>> findLatestByUser(Long userId);

    @Insert("""
        INSERT INTO user_consent_events
          (user_id, consent_type, document_version, event_type, registration_channel, is_test_data)
        VALUES
          (#{userId}, #{consentType}, #{version}, #{eventType}, #{channel}, #{testData})
        """)
    int insertEvent(
        @Param("userId") Long userId,
        @Param("consentType") String consentType,
        @Param("version") String version,
        @Param("eventType") String eventType,
        @Param("channel") String channel,
        @Param("testData") boolean testData
    );

    @Insert("""
        INSERT INTO pending_registration_intents
          (token_hash, privacy_policy_version, ai_transfer_version, expires_at, is_test_data)
        VALUES (#{tokenHash}, #{privacyVersion}, #{aiVersion}, #{expiresAt}, #{testData})
        """)
    int insertRegistrationIntent(
        @Param("tokenHash") String tokenHash,
        @Param("privacyVersion") String privacyVersion,
        @Param("aiVersion") String aiVersion,
        @Param("expiresAt") Instant expiresAt,
        @Param("testData") boolean testData
    );

    @Update("""
        UPDATE pending_registration_intents SET used_at = CURRENT_TIMESTAMP
        WHERE token_hash = #{tokenHash}
          AND privacy_policy_version = #{privacyVersion}
          AND ai_transfer_version = #{aiVersion}
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        """)
    int consumeRegistrationIntent(
        @Param("tokenHash") String tokenHash,
        @Param("privacyVersion") String privacyVersion,
        @Param("aiVersion") String aiVersion
    );

    @Insert("""
        INSERT INTO pending_google_registrations
          (token_hash, provider_subject, email, email_verified, display_name, expires_at, is_test_data)
        VALUES
          (#{tokenHash}, #{subject}, #{email}, #{emailVerified}, #{displayName}, #{expiresAt}, #{testData})
        ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash), email=VALUES(email),
          email_verified=VALUES(email_verified), display_name=VALUES(display_name),
          expires_at=VALUES(expires_at), used_at=NULL
        """)
    int insertGoogleRegistration(
        @Param("tokenHash") String tokenHash,
        @Param("subject") String subject,
        @Param("email") String email,
        @Param("emailVerified") boolean emailVerified,
        @Param("displayName") String displayName,
        @Param("expiresAt") Instant expiresAt,
        @Param("testData") boolean testData
    );

    @Select("""
        SELECT provider_subject AS subject, email, email_verified AS emailVerified,
          display_name AS displayName
        FROM pending_google_registrations
        WHERE token_hash=#{tokenHash} AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
        """)
    Map<String, Object> findUsableGoogleRegistration(String tokenHash);

    @Update("""
        UPDATE pending_google_registrations SET used_at=CURRENT_TIMESTAMP
        WHERE token_hash=#{tokenHash} AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        """)
    int consumeGoogleRegistration(String tokenHash);
}
