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
public class RegisterRequest {

    @NotBlank(message = "username is required")
    @Size(min = 4, max = 80, message = "username must be 4 to 80 characters")
    String username;

    @NotBlank(message = "password is required")
    @Size(min = 8, max = 128)
    String password;

    @NotBlank(message = "password confirmation is required")
    @Size(min = 8, max = 128)
    String confirmPassword;

    @NotBlank(message = "displayName is required")
    @Size(max = 120)
    String displayName;

    @Email(message = "email must be valid")
    @NotBlank(message = "email is required")
    String email;

    @NotBlank(message = "email verification code is required")
    @Size(min = 6, max = 6)
    String emailVerificationCode;
}
