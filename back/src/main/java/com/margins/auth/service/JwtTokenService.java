package com.margins.auth.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.dto.AuthPrincipal;
import com.margins.auth.model.UserRecord;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 액세스 토큰과 리프레시 토큰의 생성/검증을 담당한다.
 * JWT 클레임과 만료 시간을 인증 도메인에서 쓰는 Principal로 변환한다.
 */
@Service
@RequiredArgsConstructor
public class JwtTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String JWT_ALGORITHM = "HS256";
    private static final String JWT_TYPE = "JWT";
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final AuthJwtProperties properties;
    private final ObjectMapper objectMapper;

    /** 인증된 사용자에게 짧게 유지되는 서명된 access token을 만든다. */
    public String createAccessToken(UserRecord user) {
        long now = Instant.now().getEpochSecond();
        Map<String, Object> header = Map.of(
            "alg", JWT_ALGORITHM,
            "typ", JWT_TYPE
        );
        Map<String, Object> payload = Map.of(
            "iss", properties.getIssuer(),
            "sub", user.getUsername(),
            "userId", user.getId(),
            "displayName", user.getDisplayName(),
            "authProvider", user.getAuthProvider(),
            "credentialsVersion", user.getCredentialsVersion(),
            "iat", now,
            "exp", now + properties.getAccessTtlSeconds()
        );
        String unsignedToken = encodeJson(header) + "." + encodeJson(payload);

        return unsignedToken + "." + sign(unsignedToken);
    }


    /** principal을 반환하기 전에 서명, 헤더 규약, 발급자, 만료 시각을 검증한다. */
    public Optional<AuthPrincipal> validate(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Optional.empty();
            }

            String unsignedToken = parts[0] + "." + parts[1];
            if (!MessageDigest.isEqual(sign(unsignedToken).getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
                return Optional.empty();
            }

            Map<String, Object> header = objectMapper.readValue(decode(parts[0]), MAP_TYPE);
            if (!JWT_ALGORITHM.equals(header.get("alg")) || !JWT_TYPE.equals(header.get("typ"))) {
                return Optional.empty();
            }

            Map<String, Object> payload = objectMapper.readValue(decode(parts[1]), MAP_TYPE);
            if (!properties.getIssuer().equals(payload.get("iss"))) {
                return Optional.empty();
            }
            if (numberValue(payload.get("exp")) < Instant.now().getEpochSecond()) {
                return Optional.empty();
            }

            return Optional.of(AuthPrincipal.builder()
                .userId(numberValue(payload.get("userId")))
                .username(String.valueOf(payload.get("sub")))
                .displayName(stringValue(payload.get("displayName"), String.valueOf(payload.get("sub"))))
                .authProvider(stringValue(payload.get("authProvider"), "local"))
                .credentialsVersion(numberValue(payload.get("credentialsVersion")))
                .build());
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    /** JWT 헤더와 페이로드 섹션의 JSON을 Base64url로 인코딩한다. */
    private String encodeJson(Map<String, Object> value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to encode JWT payload", exception);
        }
    }

    private byte[] decode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    /** 설정된 HMAC secret으로 미서명 토큰에 서명한다. */
    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(properties.getSecret().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign JWT", exception);
        }
    }

    /** 특정 Jackson 숫자 타입에 의존하지 않고 숫자 JSON claim을 long으로 변환한다. */
    private Long numberValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        return Long.parseLong(String.valueOf(value));
    }

    /** 선택 문자열 claim을 읽고 값이 비어 있으면 대체값을 사용한다. */
    private String stringValue(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String text = String.valueOf(value);
        return text.isBlank() ? fallback : text;
    }
}
