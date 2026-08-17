package com.margins.privacy.service;

import com.margins.privacy.business.PrivacyConsentBusiness;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.dto.PrivacyConsentStatusResponse;
import com.margins.privacy.dto.PrivacyRequirementsResponse;
import com.margins.privacy.mapper.PrivacyConsentMapper;
import com.margins.privacy.model.ConsentType;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
public class PrivacyConsentService {
    private final PrivacyConsentMapper mapper;
    private final PrivacyConsentBusiness business;
    private final Environment environment;

    @Value("${margins.privacy.enforcement-enabled:false}")
    private boolean enforcementEnabled;

    public PrivacyRequirementsResponse requirements() {
        return business.requirements();
    }

    public void validate(ConsentRequest request) {
        business.validate(request);
    }

    public PrivacyConsentStatusResponse status(Long userId) {
        return business.status(mapper.findLatestByUser(userId));
    }

    public boolean hasCurrentRequiredConsents(Long userId) {
        return !status(userId).isConsentRequired();
    }

    public boolean isConsentRequiredForSession(Long userId) {
        return enforcementEnabled && !hasCurrentRequiredConsents(userId);
    }

    @Transactional
    public void grant(Long userId, ConsentRequest request, String channel, boolean testData) {
        validate(request);
        recordGrants(userId, channel, testData);
    }

    public void recordGrants(Long userId, String channel, boolean testData) {
        mapper.insertEvent(userId, ConsentType.PRIVACY_POLICY.name(), PrivacyConsentBusiness.CURRENT_VERSION,
            "GRANTED", channel, testData);
        mapper.insertEvent(userId, ConsentType.OPENAI_OVERSEAS_TRANSFER.name(), PrivacyConsentBusiness.CURRENT_VERSION,
            "GRANTED", channel, testData);
        mapper.insertEvent(userId, ConsentType.AGE_OVER_14.name(), PrivacyConsentBusiness.CURRENT_VERSION,
            "GRANTED", channel, testData);
    }

    public void recordWithdrawals(Long userId, String channel, boolean testData) {
        mapper.insertEvent(userId, ConsentType.PRIVACY_POLICY.name(), PrivacyConsentBusiness.CURRENT_VERSION,
            "WITHDRAWN", channel, testData);
        mapper.insertEvent(userId, ConsentType.OPENAI_OVERSEAS_TRANSFER.name(), PrivacyConsentBusiness.CURRENT_VERSION,
            "WITHDRAWN", channel, testData);
        mapper.insertEvent(userId, ConsentType.AGE_OVER_14.name(), PrivacyConsentBusiness.CURRENT_VERSION,
            "WITHDRAWN", channel, testData);
    }

    public String createRegistrationIntent(ConsentRequest request) {
        validate(request);
        String token = business.newToken();
        mapper.insertRegistrationIntent(
            business.hash(token), PrivacyConsentBusiness.CURRENT_VERSION, PrivacyConsentBusiness.CURRENT_VERSION,
            Instant.now().plus(10, ChronoUnit.MINUTES), isTestRuntime());
        return token;
    }

    public void consumeRegistrationIntent(String token) {
        if (token == null || mapper.consumeRegistrationIntent(
            business.hash(token),
            PrivacyConsentBusiness.CURRENT_VERSION,
            PrivacyConsentBusiness.CURRENT_VERSION
        ) != 1) {
            throw new ApiException(ApiErrorCode.PRIVACY_REGISTRATION_INTENT_INVALID);
        }
    }

    public String createGoogleRegistration(
        String subject,
        String email,
        boolean emailVerified,
        String displayName
    ) {
        String token = business.newToken();
        mapper.insertGoogleRegistration(business.hash(token), subject, email, emailVerified, displayName,
            Instant.now().plus(10, ChronoUnit.MINUTES), isTestRuntime());
        return token;
    }

    public PendingGoogleRegistration requireGoogleRegistration(String token) {
        if (token == null) {
            throw new ApiException(ApiErrorCode.PRIVACY_GOOGLE_REGISTRATION_INVALID);
        }
        Map<String, Object> row = mapper.findUsableGoogleRegistration(business.hash(token));
        if (row == null || row.isEmpty()) {
            throw new ApiException(ApiErrorCode.PRIVACY_GOOGLE_REGISTRATION_INVALID);
        }
        return new PendingGoogleRegistration(
            String.valueOf(row.get("subject")),
            row.get("email") == null ? null : String.valueOf(row.get("email")),
            Boolean.TRUE.equals(row.get("emailVerified")),
            row.get("displayName") == null ? null : String.valueOf(row.get("displayName"))
        );
    }

    public void consumeGoogleRegistration(String token) {
        if (token == null || mapper.consumeGoogleRegistration(business.hash(token)) != 1) {
            throw new ApiException(ApiErrorCode.PRIVACY_GOOGLE_REGISTRATION_INVALID);
        }
    }

    public record PendingGoogleRegistration(
        String subject,
        String email,
        boolean emailVerified,
        String displayName
    ) {}

    private boolean isTestRuntime() {
        return environment.acceptsProfiles(Profiles.of("local", "test"));
    }
}
