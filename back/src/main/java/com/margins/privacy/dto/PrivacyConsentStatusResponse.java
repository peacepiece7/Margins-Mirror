package com.margins.privacy.dto;

import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PrivacyConsentStatusResponse {
    Map<String, String> acceptedVersions;
    List<String> missingConsentTypes;
    boolean consentRequired;
}
