package com.margins.contact.controller;

import com.margins.auth.support.ClientIpResolver;
import com.margins.common.dto.ApiResponse;
import com.margins.contact.dto.ContactInquiryRequest;
import com.margins.contact.dto.ContactInquiryResponse;
import com.margins.contact.service.ContactService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공개 문의 REST API 진입점이다.
 * 문의 제출과 신뢰된 client IP 전달을 contact 서비스 계층으로 위임한다.
 */
@RestController
@RequestMapping("/api/contact-inquiries")
@RequiredArgsConstructor
public class ContactController {
    private final ContactService contactService;
    private final ClientIpResolver clientIpResolver;

    /** 공개 문의를 검증·저장·전달하고 provider 수락 뒤 생성 결과를 반환하는 POST 엔드포인트다. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContactInquiryResponse> submit(
        @Valid @RequestBody ContactInquiryRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.ok(contactService.submit(body, clientIpResolver.resolve(request)));
    }
}
