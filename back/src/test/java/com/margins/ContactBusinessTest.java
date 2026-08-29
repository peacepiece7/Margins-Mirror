package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.contact.business.ContactBusiness;
import com.margins.contact.config.ContactProperties;
import com.margins.contact.dto.ContactInquiryRequest;
import com.margins.contact.mapper.ContactMapper;
import com.margins.contact.model.ContactInquiry;
import com.margins.contact.service.ContactBotChallengeVerifier;
import com.margins.contact.service.ContactDeliveryException;
import com.margins.contact.service.ResendContactMailService;
import java.time.Duration;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.core.env.Environment;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(OutputCaptureExtension.class)
class ContactBusinessTest {
    private ContactProperties properties;
    private ContactBotChallengeVerifier verifier;
    private ContactMapper mapper;
    private ResendContactMailService mail;
    private ContactBusiness business;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        properties = new ContactProperties();
        properties.setEnabled(true);
        verifier = mock(ContactBotChallengeVerifier.class);
        mapper = mock(ContactMapper.class);
        mail = mock(ResendContactMailService.class);
        TransactionTemplate transactions = mock(TransactionTemplate.class);
        doAnswer(invocation -> {
            invocation.getArgument(0, Consumer.class).accept(mock(TransactionStatus.class));
            return null;
        }).when(transactions).executeWithoutResult(any());
        business = new ContactBusiness(properties, verifier, mapper, mail, transactions, mock(Environment.class));
    }

    @Test
    void persistsBeforeProviderThenMarksOpenAndReturnsPublicContract() {
        when(mapper.insert(any())).thenAnswer(invocation -> {
            invocation.getArgument(0, ContactInquiry.class).setId(11L);
            return 1;
        });
        when(mail.send(any())).thenReturn("provider-11");
        when(mapper.markOpen(11L, "provider-11")).thenReturn(1);

        var response = business.submit(request(), "203.0.113.4");

        assertThat(response.inquiryId()).isEqualTo(11L);
        assertThat(response.status()).isEqualTo("OPEN");
        InOrder order = inOrder(verifier, mapper, mail);
        order.verify(verifier).verify("challenge", "203.0.113.4");
        order.verify(mapper).insert(any());
        order.verify(mail).send(any());
        order.verify(mapper).markOpen(11L, "provider-11");
        ArgumentCaptor<ContactInquiry> inquiry = ArgumentCaptor.forClass(ContactInquiry.class);
        verify(mapper).insert(inquiry.capture());
        assertThat(inquiry.getValue().getEmail()).isEqualTo("reader@example.com");
        assertThat(inquiry.getValue().getStatus()).isEqualTo("PENDING_DELIVERY");
        assertThat(Duration.between(inquiry.getValue().getCreatedAt(), inquiry.getValue().getDeleteAfter()))
            .isBetween(Duration.ofDays(364), Duration.ofDays(367));
    }

    @Test
    void recordsDeliveryFailureBeforeReturningStableError(CapturedOutput output) {
        when(mapper.insert(any())).thenAnswer(invocation -> {
            invocation.getArgument(0, ContactInquiry.class).setId(12L);
            return 1;
        });
        when(mail.send(any())).thenThrow(new ContactDeliveryException("TIMEOUT"));
        when(mapper.markDeliveryFailed(12L, "TIMEOUT")).thenReturn(1);

        assertThatThrownBy(() -> business.submit(request(), "203.0.113.4"))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(ApiErrorCode.CONTACT_INQUIRY_DELIVERY_FAILED));
        verify(mapper).markDeliveryFailed(12L, "TIMEOUT");
        assertThat(output.getAll())
            .contains("inquiryId=12", "failureCode=TIMEOUT")
            .doesNotContain("reader@example.com", "Please help.", "challenge", "203.0.113.4");
    }

    @Test
    void leavesProviderAcceptedTransitionFailurePendingForManualReconciliation() {
        when(mapper.insert(any())).thenAnswer(invocation -> {
            invocation.getArgument(0, ContactInquiry.class).setId(13L);
            return 1;
        });
        when(mail.send(any())).thenReturn("provider-13");
        when(mapper.markOpen(13L, "provider-13")).thenReturn(0);

        assertThatThrownBy(() -> business.submit(request(), "203.0.113.4"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Contact inquiry open transition failed");

        verify(mapper, never()).markDeliveryFailed(any(), any());
    }

    @Test
    void disabledFeatureFailsBeforeChallengeOrPersistence() {
        properties.setEnabled(false);
        assertThatThrownBy(() -> business.submit(request(), "203.0.113.4"))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(ApiErrorCode.CONTACT_INQUIRY_UNAVAILABLE));
        verifyNoInteractions(verifier, mapper, mail);
    }

    private ContactInquiryRequest request() {
        return new ContactInquiryRequest(" Reader@Example.com ", "SERVICE_USAGE", " Need help ",
            " Please help. ", "challenge");
    }
}
