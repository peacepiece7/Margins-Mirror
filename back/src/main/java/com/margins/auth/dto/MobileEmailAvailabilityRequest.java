package com.margins.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

/** Native-only body transport keeps the reader email out of URLs and access logs. */
@Value
@Builder
@Jacksonized
public class MobileEmailAvailabilityRequest {
    @Email(message = "email must be valid")
    @NotBlank(message = "email is required")
    String email;
}
