package com.margins.privacy.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class ConsentRequest {
    @AssertTrue(message = "privacyPolicyAccepted must be true")
    boolean privacyPolicyAccepted;
    @AssertTrue(message = "aiTransferAccepted must be true")
    boolean aiTransferAccepted;
    @AssertTrue(message = "ageOver14Confirmed must be true")
    boolean ageOver14Confirmed;
    @NotBlank
    String privacyPolicyVersion;
    @NotBlank
    String aiTransferVersion;
    @Pattern(regexp = "ko|en", message = "preferredLocale must be ko or en")
    String preferredLocale;
}
