package com.margins.account.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AccountChallengeRecord {
    String id;
    Long userId;
    String purpose;
    String email;
    String codeHmac;
    int failedAttempts;
    Instant expiresAt;
    Instant verifiedAt;
    Instant usedAt;
    String actionTokenHash;
    Instant actionTokenExpiresAt;
    String requestIpHash;
    Instant createdAt;
}
