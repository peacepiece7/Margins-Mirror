package com.margins.auth.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class UserOAuthIdentityRecord {
    Long id;
    Long userId;
    String provider;
    String providerSubject;
    String providerEmail;
    Instant linkedAt;
}
