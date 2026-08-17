package com.margins.auth.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthEmailVerificationRecord {
    Long id;
    String email;
    String codeHash;
    Instant expiresAt;
    Instant usedAt;
    Instant confirmedAt;
    boolean testData;
}
