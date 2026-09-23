package com.margins.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class MobileRegisterRequest {

    @NotBlank
    String registrationIntentToken;

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

    @Pattern(regexp = "ko|en", message = "preferredLocale must be ko or en")
    String preferredLocale;

    public RegisterRequest toRegisterRequest() {
        return RegisterRequest.builder()
            .username(username)
            .password(password)
            .confirmPassword(confirmPassword)
            .displayName(displayName)
            .email(email)
            .emailVerificationCode(emailVerificationCode)
            .preferredLocale(preferredLocale)
            .build();
    }
}
