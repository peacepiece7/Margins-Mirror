package com.margins.privacy.dto;

import java.time.LocalDate;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PrivacyRequirementsResponse {
    String privacyPolicyVersion;
    String aiTransferVersion;
    LocalDate effectiveDate;
    String privacyUrl;
    String historyUrl;
    int minimumAge;
}
