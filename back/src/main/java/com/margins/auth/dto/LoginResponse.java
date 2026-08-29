package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LoginResponse {
    Long userId;
    String username;
    String displayName;
    String authMode;
    String accessToken;
    long accessTokenExpiresInSeconds;
    boolean consentRequired;
    String membershipTier;
    String preferredLocale;
}
