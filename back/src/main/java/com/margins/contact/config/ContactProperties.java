package com.margins.contact.config;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@Data
@ConfigurationProperties(prefix = "margins.contact")
public class ContactProperties {
    private boolean enabled;
    private String recipient = "support@margins.cloud";
    private Turnstile turnstile = new Turnstile();

    @PostConstruct
    public void validate() {
        if (!enabled) return;
        if (!StringUtils.hasText(recipient)
            || !StringUtils.hasText(turnstile.secretKey)
            || !StringUtils.hasText(turnstile.siteVerifyUrl)
            || turnstile.allowedHostnames.isEmpty()
            || turnstile.allowedHostnames.stream().anyMatch(host -> !StringUtils.hasText(host))
            || turnstile.timeoutSeconds <= 0) {
            throw new IllegalStateException("Contact inquiry configuration is incomplete");
        }
    }

    @Data
    public static class Turnstile {
        private String secretKey = "";
        private String siteVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
        private List<String> allowedHostnames = new ArrayList<>();
        private int timeoutSeconds = 5;
    }
}
