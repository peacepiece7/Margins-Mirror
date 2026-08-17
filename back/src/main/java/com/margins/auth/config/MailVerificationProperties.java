package com.margins.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.mail.verification")
public class MailVerificationProperties {
    private boolean enabled = false;
    private String from = "";
    private int ttlSeconds = 300;
    private boolean exposeCode = false;
}
