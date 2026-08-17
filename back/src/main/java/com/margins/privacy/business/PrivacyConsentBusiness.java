package com.margins.privacy.business;

import com.margins.privacy.dto.ConsentRequest;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.dto.PrivacyConsentStatusResponse;
import com.margins.privacy.dto.PrivacyRequirementsResponse;
import com.margins.privacy.model.ConsentType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.Base64;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class PrivacyConsentBusiness {
    public static final String CURRENT_VERSION = "2026-07-27";
    private static final SecureRandom RANDOM = new SecureRandom();

    public PrivacyRequirementsResponse requirements() {
        return PrivacyRequirementsResponse.builder()
            .privacyPolicyVersion(CURRENT_VERSION)
            .aiTransferVersion(CURRENT_VERSION)
            .effectiveDate(LocalDate.parse(CURRENT_VERSION))
            .privacyUrl("/privacy")
            .historyUrl("/privacy/history")
            .minimumAge(14)
            .build();
    }

    public void validate(ConsentRequest request) {
        if (!request.isPrivacyPolicyAccepted() || !request.isAiTransferAccepted()
            || !request.isAgeOver14Confirmed()
            || !CURRENT_VERSION.equals(request.getPrivacyPolicyVersion())
            || !CURRENT_VERSION.equals(request.getAiTransferVersion())) {
            throw new ApiException(ApiErrorCode.PRIVACY_CONSENT_INVALID);
        }
    }

    public PrivacyConsentStatusResponse status(List<Map<String, Object>> latestEvents) {
        Map<ConsentType, String> accepted = new EnumMap<>(ConsentType.class);
        for (Map<String, Object> row : latestEvents) {
            ConsentType type = ConsentType.valueOf(String.valueOf(row.get("consentType")));
            if ("GRANTED".equals(String.valueOf(row.get("eventType")))) {
                accepted.put(type, String.valueOf(row.get("documentVersion")));
            }
        }
        List<String> missing = java.util.Arrays.stream(ConsentType.values())
            .filter(type -> !CURRENT_VERSION.equals(accepted.get(type)))
            .map(Enum::name)
            .toList();
        return PrivacyConsentStatusResponse.builder()
            .acceptedVersions(accepted.entrySet().stream().collect(Collectors.toMap(
                entry -> entry.getKey().name(), Map.Entry::getValue)))
            .missingConsentTypes(missing)
            .consentRequired(!missing.isEmpty())
            .build();
    }

    public String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("registration intent could not be hashed", exception);
        }
    }
}
