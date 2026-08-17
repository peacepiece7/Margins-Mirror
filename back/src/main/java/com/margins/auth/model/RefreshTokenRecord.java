package com.margins.auth.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class RefreshTokenRecord {
    Long id;
    Long userId;
    String tokenHash;
    String jti;
    Instant expiresAt;
    Instant revokedAt;
}
