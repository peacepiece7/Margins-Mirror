package com.margins.auth.dto;

import com.margins.privacy.dto.ConsentRequest;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class NativeGoogleRegistrationRequest {
    @NotBlank
    String pendingRegistrationToken;
    @AssertTrue
    boolean privacyPolicyAccepted;
    @AssertTrue
    boolean aiTransferAccepted;
    @AssertTrue
    boolean ageOver14Confirmed;
    @NotBlank
    String privacyPolicyVersion;
    @NotBlank
    String aiTransferVersion;
    @Pattern(regexp = "ko|en")
    String preferredLocale;

    public ConsentRequest toConsentRequest() {
        return ConsentRequest.builder()
            .privacyPolicyAccepted(privacyPolicyAccepted)
            .aiTransferAccepted(aiTransferAccepted)
            .ageOver14Confirmed(ageOver14Confirmed)
            .privacyPolicyVersion(privacyPolicyVersion)
            .aiTransferVersion(aiTransferVersion)
            .preferredLocale(preferredLocale)
            .build();
    }
}
