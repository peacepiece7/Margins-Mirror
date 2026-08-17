package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthPrincipal {
    Long userId;
    String username;
    String displayName;
    String authProvider;
    long credentialsVersion;
}
