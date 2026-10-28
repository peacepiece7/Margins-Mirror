package com.margins.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class NativeGoogleOAuthExchangeRequest {
    @NotBlank
    String code;
    @NotBlank
    @Pattern(regexp = "[A-Za-z0-9_-]{43}")
    String verifier;
}
