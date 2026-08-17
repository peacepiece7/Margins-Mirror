package com.margins.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.auth.google")
public class GoogleAuthProperties {
    private boolean enabled = false;
    private String clientId = "";
    private String clientSecret = "";
    private String frontendCallbackUrl = "http://localhost:5173/auth/callback";
}