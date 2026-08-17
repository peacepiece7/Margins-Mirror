package com.margins.auth.mapper;

import com.margins.auth.model.UserOAuthIdentityRecord;
import java.util.Optional;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 사용자 OAuth 식별자 테이블에 접근하는 MyBatis 매퍼다.
 * 외부 제공자 계정과 내부 사용자 계정의 연결 상태를 조회하고 저장한다.
 */
@Mapper
public interface UserOAuthIdentityMapper {

    @Select("""
        SELECT
          id,
          user_id AS userId,
          provider,
          provider_subject AS providerSubject,
          provider_email AS providerEmail,
          linked_at AS linkedAt
        FROM user_oauth_identities
        WHERE provider = #{provider}
          AND provider_subject = #{providerSubject}
        LIMIT 1
        """)
    Optional<UserOAuthIdentityRecord> findByProviderSubject(
        @Param("provider") String provider,
        @Param("providerSubject") String providerSubject
    );

    @Select("""
        SELECT
          id,
          user_id AS userId,
          provider,
          provider_subject AS providerSubject,
          provider_email AS providerEmail,
          linked_at AS linkedAt
        FROM user_oauth_identities
        WHERE user_id = #{userId}
          AND provider = #{provider}
        LIMIT 1
        """)
    Optional<UserOAuthIdentityRecord> findByUserAndProvider(
        @Param("userId") Long userId,
        @Param("provider") String provider
    );

    @Insert("""
        INSERT INTO user_oauth_identities (
          user_id,
          provider,
          provider_subject,
          provider_email
        )
        VALUES (
          #{userId},
          #{provider},
          #{providerSubject},
          #{providerEmail}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserOAuthIdentityRecord record);
}
