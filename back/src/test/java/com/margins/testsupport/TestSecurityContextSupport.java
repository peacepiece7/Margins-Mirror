package com.margins.testsupport;

import com.margins.auth.security.MarginsUserPrincipal;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

public final class TestSecurityContextSupport {

    private TestSecurityContextSupport() {
    }

    public static void loginAs(Long userId, String username) {
        MarginsUserPrincipal principal = new MarginsUserPrincipal(userId, username, username, "local");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            principal,
            null,
            principal.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    public static void clear() {
        SecurityContextHolder.clearContext();
    }

    public static class Extension implements BeforeEachCallback, AfterEachCallback {

        @Override
        public void beforeEach(ExtensionContext context) {
            loginAs(1L, TestAuthSupport.TEST_USERNAME);
        }

        @Override
        public void afterEach(ExtensionContext context) {
            clear();
        }
    }
}
