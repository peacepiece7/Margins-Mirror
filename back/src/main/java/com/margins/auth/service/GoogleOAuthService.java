package com.margins.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Google OAuth 로그인과 계정 연동을 처리하는 서비스다.
 * 인가 URL, 토큰 교환, 사용자 정보 조회, 내부 계정 매핑을 조율한다.
 */
@Service
@RequiredArgsConstructor
public class GoogleOAuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

    private final GoogleAuthProperties googleAuthProperties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;
    private volatile JwtDecoder idTokenDecoder;

    public void requireEnabled() {
        if (!googleAuthProperties.isEnabled()) {
            throw new ApiException(ApiErrorCode.AUTH_GOOGLE_NOT_CONFIGURED);
        }
    }

    public String createState() {
        byte[] bytes = new byte[24];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String buildAuthorizationUrl(String state, String mode) {
        requireEnabled();
        String redirectUri = callbackUrl();
        String query = "client_id=" + encode(googleAuthProperties.getClientId())
            + "&redirect_uri=" + encode(redirectUri)
            + "&response_type=code"
            + "&scope=" + encode("openid email profile")
            + "&state=" + encode(state)
            + "&access_type=online"
            + "&prompt=select_account"
            + "&include_granted_scopes=true";
        if (mode != null && !mode.isBlank()) {
            query += "&login_hint=" + encode(mode);
        }
        return GOOGLE_AUTH_URL + "?" + query;
    }

    public GoogleUserProfile exchangeAuthorizationCode(String code) {
        requireEnabled();
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("code", code);
        body.add("client_id", googleAuthProperties.getClientId());
        body.add("client_secret", googleAuthProperties.getClientSecret());
        body.add("redirect_uri", callbackUrl());
        body.add("grant_type", "authorization_code");

        String responseBody = restClientBuilder.build()
            .post()
            .uri(GOOGLE_TOKEN_URL)
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(body)
            .retrieve()
            .body(String.class);

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String idToken = root.path("id_token").asText(null);
            if (idToken == null || idToken.isBlank()) {
                throw new ApiException(ApiErrorCode.AUTH_GOOGLE_TOKEN_EXCHANGE_FAILED);
            }
            return parseIdToken(idToken);
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ApiException(
                ApiErrorCode.AUTH_GOOGLE_TOKEN_EXCHANGE_FAILED,
                "failed to parse google token response",
                exception
            );
        }
    }

    public GoogleUserProfile parseIdToken(String idToken) {
        try {
            Jwt jwt = decoder().decode(idToken);
            return new GoogleUserProfile(
                jwt.getSubject(),
                jwt.getClaimAsString("email"),
                Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")),
                firstNonBlank(
                    jwt.getClaimAsString("name"),
                    jwt.getClaimAsString("given_name"),
                    jwt.getClaimAsString("email")
                )
            );
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ApiException(
                ApiErrorCode.AUTH_GOOGLE_ID_TOKEN_INVALID,
                "invalid google id token",
                exception
            );
        }
    }

    private JwtDecoder decoder() {
        JwtDecoder current = idTokenDecoder;
        if (current != null) return current;
        synchronized (this) {
            if (idTokenDecoder == null) {
                NimbusJwtDecoder decoder = NimbusJwtDecoder
                    .withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                    .build();
                OAuth2TokenValidator<Jwt> timestamps = new JwtTimestampValidator();
                OAuth2TokenValidator<Jwt> issuer = jwt -> {
                    String value = jwt.getIssuer() == null ? "" : jwt.getIssuer().toString();
                    return value.equals("https://accounts.google.com") || value.equals("accounts.google.com")
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "invalid issuer", null));
                };
                OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience().contains(googleAuthProperties.getClientId())
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "invalid audience", null));
                decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamps, issuer, audience));
                idTokenDecoder = decoder;
            }
            return idTokenDecoder;
        }
    }

    public String callbackUrl() {
        return trimTrailingSlash(System.getenv().getOrDefault("MARGINS_PUBLIC_BASE_URL", "http://localhost:8080"))
            + "/api/auth/oauth/google/callback";
    }

    private String optionalText(JsonNode payload, String field) {
        String value = payload.path(field).asText(null);
        return value == null || value.isBlank() ? null : value;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "Google User";
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String trimTrailingSlash(String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    public record GoogleUserProfile(String subject, String email, boolean emailVerified, String displayName) {
    }
}
