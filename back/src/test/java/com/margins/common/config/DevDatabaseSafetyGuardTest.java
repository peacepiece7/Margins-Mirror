package com.margins.common.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class DevDatabaseSafetyGuardTest {

    @Test
    void acceptsOnlyTheGuardedLocalSharedDevConfiguration() {
        MockEnvironment environment = safeEnvironment();

        assertDoesNotThrow(() -> new DevDatabaseSafetyGuard(environment).validate());
    }

    @Test
    void rejectsAnUnsafeOverrideOfEveryProtectedSettingWithoutShowingValues() {
        for (String key : DevDatabaseSafetyGuard.REQUIRED.keySet()) {
            MockEnvironment environment = safeEnvironment();
            environment.setProperty(key, "unsafe-override");

            IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> new DevDatabaseSafetyGuard(environment).validate());
            assertTrue(error.getMessage().contains(key));
            assertTrue(!error.getMessage().contains("unsafe-override"));
        }
    }

    @Test
    void rejectsMissingProdProtectionAndWeakOrMissingSecrets() {
        MockEnvironment withoutProd = safeEnvironment();
        withoutProd.setActiveProfiles("dev");
        assertThrows(IllegalStateException.class,
            () -> new DevDatabaseSafetyGuard(withoutProd).validate());

        for (String resetProfile : new String[] {"local", "test"}) {
            MockEnvironment withResetProfile = safeEnvironment();
            withResetProfile.setActiveProfiles("dev", "prod", resetProfile);
            assertThrows(IllegalStateException.class,
                () -> new DevDatabaseSafetyGuard(withResetProfile).validate());
        }

        for (String key : new String[] {
            "spring.datasource.password", "margins.auth.jwt.secret", "margins.auth.challenge-secret"
        }) {
            MockEnvironment environment = safeEnvironment();
            environment.setProperty(key, "change-me-secret");
            assertThrows(IllegalStateException.class,
                () -> new DevDatabaseSafetyGuard(environment).validate());
        }
    }

    private MockEnvironment safeEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("dev", "prod");
        DevDatabaseSafetyGuard.REQUIRED.forEach(environment::setProperty);
        environment.setProperty("spring.datasource.password", "non-placeholder-dev-password");
        environment.setProperty("margins.auth.jwt.secret", "0123456789abcdef0123456789abcdef0123456789abcdef");
        environment.setProperty("margins.auth.challenge-secret", "abcdef0123456789abcdef0123456789abcdef0123456789");
        return environment;
    }
}
