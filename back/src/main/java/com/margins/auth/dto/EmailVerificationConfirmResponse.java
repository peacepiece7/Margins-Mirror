package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class EmailVerificationConfirmResponse {
    String email;
    boolean verified;
}
