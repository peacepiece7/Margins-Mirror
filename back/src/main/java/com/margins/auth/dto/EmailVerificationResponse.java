package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class EmailVerificationResponse {
    String email;
    long expiresInSeconds;
    long resendAfterSeconds;
    String devVerificationCode;
}
