package com.margins.contact.service;

import com.margins.contact.business.ContactBusiness;
import com.margins.contact.dto.ContactInquiryRequest;
import com.margins.contact.dto.ContactInquiryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 공개 문의 controller와 업무 규칙 사이의 서비스 계층이다.
 * 검증된 제출 요청을 contact business 흐름으로 전달한다.
 */
@Service
@RequiredArgsConstructor
public class ContactService {
    private final ContactBusiness business;

    public ContactInquiryResponse submit(ContactInquiryRequest request, String clientIp) {
        return business.submit(request, clientIp);
    }
}
