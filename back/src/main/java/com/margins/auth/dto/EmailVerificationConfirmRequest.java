package com.margins.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class EmailVerificationConfirmRequest {

    @Email(message = "email must be valid")
    @NotBlank(message = "email is required")
    String email;

    @NotBlank(message = "email verification code is required")
    @Size(min = 6, max = 6)
    String code;
}
