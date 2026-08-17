package com.margins.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.mail.resend")
public class ResendProperties {
    private String apiKey = "";
    private String baseUrl = "https://api.resend.com";
    private int timeoutSeconds = 10;
}
