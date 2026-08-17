package com.margins.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.auth.cookie")
public class AuthCookieProperties {
    private String refreshName = "margins_refresh";
    private String oauthStateName = "margins_oauth_state";
    private String registrationIntentName = "margins_registration_intent";
    private String googleRegistrationName = "margins_google_registration";
    private boolean secure = false;
    private String refreshSameSite = "Strict";
    private String oauthStateSameSite = "Lax";
    private String path = "/api/auth";
}
