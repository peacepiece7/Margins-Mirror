package com.margins.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class LoginRequest {
    @NotBlank
    String username;
    @NotBlank
    String password;
}
