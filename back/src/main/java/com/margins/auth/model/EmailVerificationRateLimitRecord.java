package com.margins.auth.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder(toBuilder = true)
public class EmailVerificationRateLimitRecord {
    String scopeType;
    String scopeHash;
    Instant minuteWindowStartedAt;
    int minuteCount;
    Instant hourWindowStartedAt;
    int hourCount;
    Instant dayWindowStartedAt;
    int dayCount;
    Instant retentionAfter;
    boolean testData;
}
