package com.margins.common.config;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/** Rejects unsafe direct IDE launches before a shared development database can be queried. */
@Component
@Profile("dev")
public class DevDatabaseSafetyGuard {

    private static final String DEV_JDBC_URL =
        "jdbc:mysql://127.0.0.1:13307/margins_dev?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    static final Map<String, String> REQUIRED = Map.ofEntries(
        Map.entry("MARGINS_DB_TARGET", "shared-dev"),
        Map.entry("MARGINS_SHARED_DEV_DB_TUNNEL_PORT", "13307"),
        Map.entry("spring.datasource.url", DEV_JDBC_URL),
        Map.entry("spring.datasource.username", "margins_dev"),
        Map.entry("server.address", "127.0.0.1"),
        Map.entry("server.port", "5813"),
        Map.entry("margins.maintenance.enabled", "false"),
        Map.entry("margins.test-support.catalog-fixture-enabled", "false"),
        Map.entry("margins.catalog.worker-enabled", "false"),
        Map.entry("margins.catalog.test-data", "false"),
        Map.entry("margins.contact.enabled", "false"),
        Map.entry("margins.auth.cookie.secure", "false"),
        Map.entry("margins.auth.cookie.domain", ""),
        Map.entry("margins.auth.jwt.issuer", "margins-local-shared-dev"),
        Map.entry("margins.auth.google.enabled", "false"),
        Map.entry("margins.auth.google.mobile-enabled", "false"),
        Map.entry("margins.auth.native-turnstile-bridge.enabled", "false"),
        Map.entry("margins.cors.allowed-origin", "http://localhost:9613"),
        Map.entry("margins.mail.verification.enabled", "false"),
        Map.entry("margins.mail.verification.expose-code", "false"),
        Map.entry("margins.ai.provider", "placeholder"),
        Map.entry("margins.ai.langfuse.enabled", "false")
    );

    private final Environment environment;

    public DevDatabaseSafetyGuard(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    void validate() {
        if (!environment.acceptsProfiles(Profiles.of("prod"))
            || environment.acceptsProfiles(Profiles.of("local", "test"))) {
            throw new IllegalStateException("dev profile requires prod and forbids local/test reset profiles");
        }
        for (Map.Entry<String, String> required : REQUIRED.entrySet()) {
            if (!required.getValue().equals(environment.getProperty(required.getKey()))) {
                throw new IllegalStateException("Unsafe dev configuration: " + required.getKey());
            }
        }
        requireSecret("spring.datasource.password", 1);
        requireSecret("margins.auth.jwt.secret", 32);
        requireSecret("margins.auth.challenge-secret", 32);
    }

    private void requireSecret(String key, int minimumLength) {
        String value = environment.getProperty(key, "").trim();
        if (value.length() < minimumLength || value.matches("(?i)^(change-me|placeholder|todo|example|margins-pass)(?:$|[-_]).*")
            || value.startsWith("margins-local-")) {
            throw new IllegalStateException("Unsafe dev configuration: " + key);
        }
    }
}
