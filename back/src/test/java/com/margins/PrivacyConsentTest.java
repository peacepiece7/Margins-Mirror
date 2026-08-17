package com.margins;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.business.PrivacyConsentBusiness;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.mapper.PrivacyConsentMapper;
import com.margins.privacy.service.PrivacyConsentService;
import java.util.List;
import java.util.Map;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

class PrivacyConsentTest {

    private final PrivacyConsentBusiness business = new PrivacyConsentBusiness();
    private final PrivacyConsentMapper mapper = mock(PrivacyConsentMapper.class);
    private final PrivacyConsentService service = new PrivacyConsentService(
        mapper, business, mock(Environment.class));

    @Test
    void rejectsMissingRequiredConsentAndPastVersions() {
        ConsentRequest request = ConsentRequest.builder()
            .privacyPolicyAccepted(true)
            .aiTransferAccepted(false)
            .ageOver14Confirmed(true)
            .privacyPolicyVersion("2026-07-27")
            .aiTransferVersion("2026-01-01")
            .build();

        assertThatThrownBy(() -> service.validate(request))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.PRIVACY_CONSENT_INVALID));
    }

    @Test
    void reportsWithdrawnAndPastVersionConsentsAsMissing() {
        var status = business.status(List.of(
            Map.of("consentType", "PRIVACY_POLICY", "documentVersion", "2026-07-27", "eventType", "GRANTED"),
            Map.of("consentType", "OPENAI_OVERSEAS_TRANSFER", "documentVersion", "2026-01-01",
                "eventType", "GRANTED"),
            Map.of("consentType", "AGE_OVER_14", "documentVersion", "2026-07-27", "eventType", "WITHDRAWN")
        ));

        assertThat(status.isConsentRequired()).isTrue();
        assertThat(status.getMissingConsentTypes())
            .containsExactlyInAnyOrder("OPENAI_OVERSEAS_TRANSFER", "AGE_OVER_14");
    }

    @Test
    void createsHashedRegistrationIntentAndConsumesItOnce() {
        ConsentRequest request = acceptedRequest();
        when(mapper.consumeRegistrationIntent(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(PrivacyConsentBusiness.CURRENT_VERSION),
            org.mockito.ArgumentMatchers.eq(PrivacyConsentBusiness.CURRENT_VERSION)
        ))
            .thenReturn(1)
            .thenReturn(0);

        String rawToken = service.createRegistrationIntent(request);
        service.consumeRegistrationIntent(rawToken);

        ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
        verify(mapper).insertRegistrationIntent(
            hash.capture(),
            org.mockito.ArgumentMatchers.eq("2026-07-27"),
            org.mockito.ArgumentMatchers.eq("2026-07-27"),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyBoolean()
        );
        assertThat(hash.getValue()).hasSize(64).isNotEqualTo(rawToken);
        verify(mapper).consumeRegistrationIntent(
            hash.getValue(),
            PrivacyConsentBusiness.CURRENT_VERSION,
            PrivacyConsentBusiness.CURRENT_VERSION
        );
        assertThatThrownBy(() -> service.consumeRegistrationIntent(rawToken))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.PRIVACY_REGISTRATION_INTENT_INVALID));
    }

    @Test
    void preservesGoogleProfileOnlyBehindHashedOneTimePendingToken() {
        ConsentRequest request = acceptedRequest();
        String rawToken = service.createGoogleRegistration(
            "google-subject", "reader@example.com", true, "Reader");
        String hash = business.hash(rawToken);
        when(mapper.findUsableGoogleRegistration(hash)).thenReturn(Map.of(
            "subject", "google-subject",
            "email", "reader@example.com",
            "emailVerified", true,
            "displayName", "Reader"
        ));
        when(mapper.consumeGoogleRegistration(hash)).thenReturn(1).thenReturn(0);

        business.validate(request);
        var pending = service.requireGoogleRegistration(rawToken);
        service.consumeGoogleRegistration(rawToken);

        assertThat(pending.subject()).isEqualTo("google-subject");
        assertThat(rawToken).isNotEqualTo(hash);
        assertThatThrownBy(() -> service.consumeGoogleRegistration(rawToken))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.PRIVACY_GOOGLE_REGISTRATION_INVALID));
    }

    @Test
    void recordsAllThreeRequiredGrantsForTheCurrentVersion() {
        service.grant(9L, acceptedRequest(), "EXISTING", true);

        verify(mapper).insertEvent(9L, "PRIVACY_POLICY", "2026-07-27", "GRANTED", "EXISTING", true);
        verify(mapper).insertEvent(
            9L, "OPENAI_OVERSEAS_TRANSFER", "2026-07-27", "GRANTED", "EXISTING", true);
        verify(mapper).insertEvent(9L, "AGE_OVER_14", "2026-07-27", "GRANTED", "EXISTING", true);
    }

    private ConsentRequest acceptedRequest() {
        return ConsentRequest.builder()
            .privacyPolicyAccepted(true)
            .aiTransferAccepted(true)
            .ageOver14Confirmed(true)
            .privacyPolicyVersion("2026-07-27")
            .aiTransferVersion("2026-07-27")
            .build();
    }
}
