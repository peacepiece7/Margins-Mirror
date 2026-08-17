package com.margins.auth.mapper;

import com.margins.auth.model.RefreshTokenRecord;
import java.util.Optional;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 리프레시 토큰 저장소에 접근하는 MyBatis 매퍼다.
 * 토큰 발급, 조회, 폐기, 사용자 단위 정리를 담당한다.
 */
@Mapper
public interface RefreshTokenMapper {

    @Insert("""
        INSERT INTO refresh_tokens (
          user_id,
          token_hash,
          jti,
          expires_at
        )
        VALUES (
          #{userId},
          #{tokenHash},
          #{jti},
          #{expiresAt}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(RefreshTokenRecord record);

    @Select("""
        SELECT
          id,
          user_id AS userId,
          token_hash AS tokenHash,
          jti,
          expires_at AS expiresAt,
          revoked_at AS revokedAt
        FROM refresh_tokens
        WHERE token_hash = #{tokenHash}
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
        """)
    Optional<RefreshTokenRecord> findActiveByTokenHash(String tokenHash);

    @Update("""
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE jti = #{jti}
          AND revoked_at IS NULL
        """)
    int revokeByJti(String jti);

    @Update("""
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = #{userId}
          AND revoked_at IS NULL
        """)
    int revokeAllForUser(@Param("userId") Long userId);
}
