package com.margins.auth.config;

import java.util.List;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.auth.google")
public class GoogleAuthProperties {
    private boolean enabled = false;
    private String clientId = "";
    private String clientSecret = "";
    private String frontendCallbackUrl = "http://localhost:5173/auth/callback";
    private boolean mobileEnabled = false;
    private List<String> mobileRedirectUris = List.of();
}
