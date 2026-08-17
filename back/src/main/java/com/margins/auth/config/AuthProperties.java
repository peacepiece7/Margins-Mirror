package com.margins.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.auth")
public class AuthProperties {
    private int maxFailedLogins = 5;
    private long lockoutMinutes = 15;
}
