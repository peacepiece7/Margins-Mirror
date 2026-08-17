package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.dto.AuthPrincipal;
import com.margins.auth.model.UserRecord;
import com.margins.auth.service.JwtTokenService;
import com.margins.testsupport.TestAuthSupport;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class JwtTokenServiceTest {

    private static final String TEST_SECRET = "test-secret";
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void createsAndValidatesSignedToken() {
        JwtTokenService service = tokenService(TEST_SECRET, 60);
        UserRecord user = TestAuthSupport.demo_readerUser();

        String token = service.createAccessToken(user);

        assertThat(token.split("\\.")).hasSize(3);
        Optional<AuthPrincipal> principal = service.validate(token);
        assertThat(principal).isPresent();
        assertThat(principal.get().getUserId()).isEqualTo(1L);
        assertThat(principal.get().getUsername()).isEqualTo("demo_reader");
    }

    @Test
    void rejectsTamperedToken() {
        JwtTokenService service = tokenService(TEST_SECRET, 60);
        String token = service.createAccessToken(TestAuthSupport.demo_readerUser()) + "tampered";

        assertThat(service.validate(token)).isEmpty();
    }

    @Test
    void rejectsSignedTokenWithUnexpectedHeaderAlgorithm() {
        JwtTokenService service = tokenService(TEST_SECRET, 60);
        String token = signedToken(Map.of("alg", "none", "typ", "JWT"));

        assertThat(service.validate(token)).isEmpty();
    }

    @Test
    void rejectsSignedTokenWithUnexpectedHeaderType() {
        JwtTokenService service = tokenService(TEST_SECRET, 60);
        String token = signedToken(Map.of("alg", "HS256", "typ", "JWS"));

        assertThat(service.validate(token)).isEmpty();
    }

    @Test
    void rejectsExpiredToken() {
        JwtTokenService service = tokenService(TEST_SECRET, -1);
        String token = service.createAccessToken(TestAuthSupport.demo_readerUser());

        assertThat(service.validate(token)).isEmpty();
    }

    private JwtTokenService tokenService(String secret, long accessTtlSeconds) {
        AuthJwtProperties properties = new AuthJwtProperties();
        properties.setIssuer("margins-test");
        properties.setSecret(secret);
        properties.setAccessTtlSeconds(accessTtlSeconds);

        return new JwtTokenService(properties, new ObjectMapper());
    }

    private String signedToken(Map<String, Object> header) {
        long now = Instant.now().getEpochSecond();
        Map<String, Object> payload = Map.of(
            "iss", "margins-test",
            "sub", "demo_reader",
            "userId", 1L,
            "displayName", "demo_reader",
            "authProvider", "local",
            "iat", now,
            "exp", now + 60
        );
        String unsignedToken = encode(header) + "." + encode(payload);

        return unsignedToken + "." + sign(unsignedToken);
    }

    private String encode(Map<String, Object> value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to encode test JWT", exception);
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(TEST_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign test JWT", exception);
        }
    }
}
