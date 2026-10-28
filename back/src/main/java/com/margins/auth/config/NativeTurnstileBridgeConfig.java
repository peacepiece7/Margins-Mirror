package com.margins.auth.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(NativeTurnstileBridgeProperties.class)
public class NativeTurnstileBridgeConfig {
}
