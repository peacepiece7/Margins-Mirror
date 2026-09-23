package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NativeSessionResponse {
    Long userId;
    String username;
    String displayName;
    String authMode;
    String accessToken;
    long accessTokenExpiresInSeconds;
    boolean consentRequired;
    String membershipTier;
    String preferredLocale;
    String refreshToken;
    long refreshTokenExpiresInSeconds;

    public static NativeSessionResponse from(
        LoginResponse response,
        String refreshToken,
        long refreshTokenExpiresInSeconds
    ) {
        return NativeSessionResponse.builder()
            .userId(response.getUserId())
            .username(response.getUsername())
            .displayName(response.getDisplayName())
            .authMode(response.getAuthMode())
            .accessToken(response.getAccessToken())
            .accessTokenExpiresInSeconds(response.getAccessTokenExpiresInSeconds())
            .consentRequired(response.isConsentRequired())
            .membershipTier(response.getMembershipTier())
            .preferredLocale(response.getPreferredLocale())
            .refreshToken(refreshToken)
            .refreshTokenExpiresInSeconds(refreshTokenExpiresInSeconds)
            .build();
    }
}
