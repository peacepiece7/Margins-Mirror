package com.margins.auth.service;

import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.mapper.RefreshTokenMapper;
import com.margins.auth.model.RefreshTokenRecord;
import com.margins.auth.model.UserRecord;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 리프레시 토큰 수명주기를 관리하는 서비스다.
 * 토큰 발급, 회전, 폐기, 사용자 단위 로그아웃 처리를 담당한다.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RefreshTokenMapper refreshTokenMapper;
    private final AuthJwtProperties authJwtProperties;

    /** 해시된 refresh token을 저장하고 호출자에게는 원문 값만 반환한다. */
    public IssuedRefreshToken issue(UserRecord user) {
        String rawToken = generateRawToken();
        String jti = UUID.randomUUID().toString().replace("-", "");
        RefreshTokenRecord record = RefreshTokenRecord.builder()
            .userId(user.getId())
            .tokenHash(hash(rawToken))
            .jti(jti)
            .expiresAt(Instant.now().plusSeconds(authJwtProperties.getRefreshTtlSeconds()))
            .build();
        refreshTokenMapper.insert(record);
        return new IssuedRefreshToken(rawToken, jti, record.getExpiresAt());
    }

    /** 원문 refresh token을 저장된 해시와 활성 사용자 기준으로 검증한다. */
    public Optional<UserRecord> validateRawToken(String rawToken, UserLookup lookup) {
        return refreshTokenMapper.findActiveByTokenHash(hash(rawToken))
            .flatMap(record -> lookup.findById(record.getUserId()));
    }

    /** 사용된 refresh token을 폐기하고 같은 회전 흐름에서 새 토큰을 발급한다. */
    public Optional<RotationResult> rotate(String rawToken, UserLookup lookup) {
        Optional<RefreshTokenRecord> existing = refreshTokenMapper.findActiveByTokenHash(hash(rawToken));
        if (existing.isEmpty()) {
            return Optional.empty();
        }

        RefreshTokenRecord record = existing.get();
        refreshTokenMapper.revokeByJti(record.getJti());
        return lookup.findById(record.getUserId())
            .map(user -> new RotationResult(user, issue(user)));
    }

    /** 원문 쿠키 값과 일치하는 활성 토큰을 폐기한다. */
    public void revokeRawToken(String rawToken) {
        refreshTokenMapper.findActiveByTokenHash(hash(rawToken))
            .ifPresent(record -> refreshTokenMapper.revokeByJti(record.getJti()));
    }

    /** 로그아웃 대체 처리에 쓰도록 사용자의 모든 refresh token을 폐기한다. */
    public void revokeAllForUser(Long userId) {
        refreshTokenMapper.revokeAllForUser(userId);
    }

    /** 브라우저 쿠키에 넣을 불투명한 고엔트로피 토큰을 생성한다. */
    private String generateRawToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** 데이터베이스 행이 유출돼도 bearer credential이 되지 않도록 refresh token을 저장 전에 해시한다. */
    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte value : hashed) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to hash refresh token", exception);
        }
    }

    public record IssuedRefreshToken(String rawToken, String jti, Instant expiresAt) {
    }

    public record RotationResult(UserRecord user, IssuedRefreshToken refreshToken) {
    }

    @FunctionalInterface
    public interface UserLookup {
        Optional<UserRecord> findById(Long userId);
    }
}
