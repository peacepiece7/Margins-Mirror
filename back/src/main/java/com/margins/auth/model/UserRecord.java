package com.margins.auth.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class UserRecord {
    Long id;
    String username;
    String displayName;
    String email;
    boolean emailVerified;
    String preferredLocale;
    String passwordHash;
    String authProvider;
    String accountStatus;
    Instant resignedAt;
    Instant personalDataPurgeScheduledAt;
    Instant personalDataPurgedAt;
    long credentialsVersion;
    boolean eraseActivityOnPurge;
    int failedLoginCount;
    Instant lockedUntil;
    Instant lastLoginAt;
    boolean testData;
}
