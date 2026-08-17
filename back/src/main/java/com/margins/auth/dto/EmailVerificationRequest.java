package com.margins.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class EmailVerificationRequest {

    @Email(message = "email must be valid")
    @NotBlank(message = "email is required")
    String email;

    String botChallengeToken;
}
