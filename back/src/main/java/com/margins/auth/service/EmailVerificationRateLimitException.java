package com.margins.auth.service;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import lombok.Getter;

@Getter
public class EmailVerificationRateLimitException extends ApiException {
    private final long retryAfterSeconds;

    public EmailVerificationRateLimitException(long retryAfterSeconds) {
        super(ApiErrorCode.AUTH_EMAIL_VERIFICATION_RATE_LIMITED);
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }
}
