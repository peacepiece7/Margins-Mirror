package com.margins.auth.mapper;

import com.margins.auth.model.AuthEmailVerificationRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 이메일 인증 코드 저장소에 접근하는 MyBatis 매퍼다.
 * 코드 발급, 조회, 사용 처리와 만료 정리를 담당한다.
 */
@Mapper
public interface AuthEmailVerificationMapper {

    @Insert("""
        INSERT INTO auth_email_verifications (
          email,
          code_hash,
          expires_at,
          is_test_data
        )
        VALUES (
          #{email},
          #{codeHash},
          #{expiresAt},
          #{testData}
        )
        """)
    int insert(AuthEmailVerificationRecord record);

    @Update("""
        UPDATE auth_email_verifications
        SET used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = #{email}
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        """)
    int expireActiveForEmail(@Param("email") String email);

    @Update("""
        UPDATE auth_email_verifications
        SET used_at = CURRENT_TIMESTAMP,
            confirmed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = #{email}
          AND code_hash = #{codeHash}
          AND used_at IS NULL
          AND failed_attempts < 5
          AND expires_at > CURRENT_TIMESTAMP
        """)
    int consumeActiveCode(
        @Param("email") String email,
        @Param("codeHash") String codeHash
    );

    @Select("""
        SELECT COUNT(*)
        FROM auth_email_verifications
        WHERE email = #{email}
          AND code_hash = #{codeHash}
          AND confirmed_at IS NOT NULL
          AND expires_at > CURRENT_TIMESTAMP
        """)
    int countVerifiedCode(
        @Param("email") String email,
        @Param("codeHash") String codeHash
    );

    @Update("""
        UPDATE auth_email_verifications
        SET used_at = CASE WHEN failed_attempts >= 4 THEN CURRENT_TIMESTAMP ELSE used_at END,
            failed_attempts = failed_attempts + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = #{email}
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY id DESC
        LIMIT 1
        """)
    int recordFailedAttempt(@Param("email") String email);
}
