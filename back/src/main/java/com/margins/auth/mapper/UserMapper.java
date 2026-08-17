package com.margins.auth.mapper;

import com.margins.auth.model.UserRecord;
import java.util.Optional;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 사용자 계정 테이블에 접근하는 MyBatis 매퍼다.
 * 가입, 중복 확인, 로그인 조회, OAuth 연동용 사용자 조회를 담당한다.
 */
@Mapper
public interface UserMapper {

    @Select("""
        SELECT
          id,
          username,
          display_name AS displayName,
          email,
          email_verified AS emailVerified,
          password_hash AS passwordHash,
          auth_provider AS authProvider,
          account_status AS accountStatus,
          resigned_at AS resignedAt,
          personal_data_purge_scheduled_at AS personalDataPurgeScheduledAt,
          personal_data_purged_at AS personalDataPurgedAt,
          credentials_version AS credentialsVersion,
          erase_activity_on_purge AS eraseActivityOnPurge,
          failed_login_count AS failedLoginCount,
          locked_until AS lockedUntil,
          last_login_at AS lastLoginAt,
          is_test_data AS testData
        FROM users
        WHERE username = #{username}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    Optional<UserRecord> findByUsername(String username);

    @Select("""
        SELECT
          id,
          username,
          display_name AS displayName,
          email,
          email_verified AS emailVerified,
          password_hash AS passwordHash,
          auth_provider AS authProvider,
          account_status AS accountStatus,
          resigned_at AS resignedAt,
          personal_data_purge_scheduled_at AS personalDataPurgeScheduledAt,
          personal_data_purged_at AS personalDataPurgedAt,
          credentials_version AS credentialsVersion,
          erase_activity_on_purge AS eraseActivityOnPurge,
          failed_login_count AS failedLoginCount,
          locked_until AS lockedUntil,
          last_login_at AS lastLoginAt,
          is_test_data AS testData
        FROM users
        WHERE id = #{userId}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    Optional<UserRecord> findById(Long userId);

    @Select("""
        SELECT
          id,
          username,
          display_name AS displayName,
          email,
          email_verified AS emailVerified,
          password_hash AS passwordHash,
          auth_provider AS authProvider,
          account_status AS accountStatus,
          resigned_at AS resignedAt,
          personal_data_purge_scheduled_at AS personalDataPurgeScheduledAt,
          personal_data_purged_at AS personalDataPurgedAt,
          credentials_version AS credentialsVersion,
          erase_activity_on_purge AS eraseActivityOnPurge,
          failed_login_count AS failedLoginCount,
          locked_until AS lockedUntil,
          last_login_at AS lastLoginAt,
          is_test_data AS testData
        FROM users
        WHERE email = #{email}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    Optional<UserRecord> findByEmail(String email);

    @Insert("""
        INSERT INTO users (
          username,
          display_name,
          email,
          email_verified,
          password_hash,
          auth_provider,
          is_test_data
        )
        VALUES (
          #{username},
          #{displayName},
          #{email},
          #{emailVerified},
          #{passwordHash},
          #{authProvider},
          #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserRecord record);

    @Update("""
        UPDATE users
        SET
          failed_login_count = #{failedLoginCount},
          locked_until = #{lockedUntil},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND deleted_at IS NULL
        """)
    int updateLoginFailure(UserRecord record);

    @Update("""
        UPDATE users
        SET
          failed_login_count = 0,
          locked_until = NULL,
          last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{userId}
          AND deleted_at IS NULL
        """)
    int resetLoginSuccess(@Param("userId") Long userId);

    @Update("""
        UPDATE users
        SET
          auth_provider = #{authProvider},
          email_verified = CASE WHEN #{emailVerified} THEN TRUE ELSE email_verified END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = #{userId}
          AND deleted_at IS NULL
        """)
    int updateAuthProvider(
        @Param("userId") Long userId,
        @Param("authProvider") String authProvider,
        @Param("emailVerified") boolean emailVerified
    );
}
