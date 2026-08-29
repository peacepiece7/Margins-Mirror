package com.margins.contact.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ContactInquiryRequest(
    @NotBlank @Email @Size(max = 254)
    @Pattern(regexp = "^[^\\x00-\\x1F\\x7F]*$") String email,
    @NotBlank @Pattern(regexp = "SERVICE_USAGE|ACCOUNT_LOGIN|PRIVACY|BUG_REPORT|FEATURE_REQUEST|OTHER") String category,
    @NotBlank @Size(max = 160) @Pattern(regexp = "^[^\\x00-\\x1F\\x7F]*$") String subject,
    @NotBlank @Size(max = 5000) @Pattern(regexp = "^[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$") String message,
    @Size(max = 2048) String botChallengeToken
) { }
