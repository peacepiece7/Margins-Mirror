package com.margins.auth.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(GoogleAuthProperties.class)
public class GoogleOAuthConfig {

    @Bean
    RestClient.Builder googleOAuthRestClientBuilder() {
        return RestClient.builder();
    }
}
