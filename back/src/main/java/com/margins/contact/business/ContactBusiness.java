package com.margins.contact.business;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.contact.config.ContactProperties;
import com.margins.contact.dto.ContactInquiryRequest;
import com.margins.contact.dto.ContactInquiryResponse;
import com.margins.contact.mapper.ContactMapper;
import com.margins.contact.model.ContactInquiry;
import com.margins.contact.service.ContactBotChallengeVerifier;
import com.margins.contact.service.ContactDeliveryException;
import com.margins.contact.service.ResendContactMailService;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 공개 문의의 challenge, 영속 상태 전이와 운영자 알림을 조정하는 business 계층이다.
 * provider 호출을 DB transaction 밖에 두고 전달 결과를 명시적으로 기록한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ContactBusiness {
    private final ContactProperties properties;
    private final ContactBotChallengeVerifier botChallengeVerifier;
    private final ContactMapper mapper;
    private final ResendContactMailService mailService;
    private final TransactionTemplate transactionTemplate;
    private final Environment environment;

    public ContactInquiryResponse submit(ContactInquiryRequest request, String clientIp) {
        if (!properties.isEnabled()) throw new ApiException(ApiErrorCode.CONTACT_INQUIRY_UNAVAILABLE);
        botChallengeVerifier.verify(request.botChallengeToken(), clientIp);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        ContactInquiry inquiry = ContactInquiry.builder()
            .email(request.email().trim().toLowerCase(Locale.ROOT))
            .category(request.category())
            .subject(request.subject().trim())
            .message(request.message().trim())
            .status("PENDING_DELIVERY")
            .createdAt(now)
            .deleteAfter(now.atZone(ZoneOffset.UTC).plusYears(1).toInstant())
            .testData(environment.acceptsProfiles(Profiles.of("local", "test")))
            .build();
        transactionTemplate.executeWithoutResult(status -> {
            if (mapper.insert(inquiry) != 1 || inquiry.getId() == null) {
                throw new IllegalStateException("Contact inquiry was not persisted");
            }
        });
        try {
            String providerMessageId = mailService.send(inquiry);
            transactionTemplate.executeWithoutResult(status -> requireOne(mapper.markOpen(
                inquiry.getId(), providerMessageId), "open"));
            return new ContactInquiryResponse(inquiry.getId(), "OPEN", inquiry.getCreatedAt());
        } catch (ContactDeliveryException exception) {
            transactionTemplate.executeWithoutResult(status -> requireOne(mapper.markDeliveryFailed(
                inquiry.getId(), exception.getFailureCode()), "failed"));
            log.warn("Contact inquiry email delivery failed inquiryId={} failureCode={}",
                inquiry.getId(), exception.getFailureCode());
            throw new ApiException(ApiErrorCode.CONTACT_INQUIRY_DELIVERY_FAILED);
        }
    }

    private void requireOne(int count, String transition) {
        if (count != 1) throw new IllegalStateException("Contact inquiry " + transition + " transition failed");
    }
}
