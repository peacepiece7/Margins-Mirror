package com.margins.auth.config;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@Data
@ConfigurationProperties(prefix = "margins.auth.email-verification-abuse")
public class EmailVerificationAbuseProperties {
    private boolean enabled;
    private String rateLimitSecret = "";
    private int resendAfterSeconds = 60;
    private Turnstile turnstile = new Turnstile();

    @PostConstruct
    public void validate() {
        if (!enabled) return;
        if (!StringUtils.hasText(rateLimitSecret)) {
            throw new IllegalStateException(
                "MARGINS_EMAIL_VERIFICATION_RATE_LIMIT_SECRET is required when abuse protection is enabled");
        }
        if (resendAfterSeconds < 60) {
            throw new IllegalStateException("email verification resend delay must be at least 60 seconds");
        }
        if (!StringUtils.hasText(turnstile.secretKey)
            || !StringUtils.hasText(turnstile.siteVerifyUrl)
            || !StringUtils.hasText(turnstile.expectedAction)
            || turnstile.allowedHostnames.isEmpty()
            || turnstile.allowedHostnames.stream().anyMatch(host -> !StringUtils.hasText(host))
            || turnstile.timeoutSeconds <= 0) {
            throw new IllegalStateException("Turnstile configuration is incomplete");
        }
    }

    @Data
    public static class Turnstile {
        private String secretKey = "";
        private String siteVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
        private String expectedAction = "email_verification";
        private List<String> allowedHostnames = new ArrayList<>();
        private int timeoutSeconds = 5;
    }
}
