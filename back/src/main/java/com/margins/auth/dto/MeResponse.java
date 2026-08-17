package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MeResponse {
    Long userId;
    String username;
    String displayName;
    String email;
    boolean emailVerified;
    String authProvider;
}
