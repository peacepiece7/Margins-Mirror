package com.margins.auth.service;

/**
 * 메일 발송 구현체의 공통 계약이다.
 * 이메일 인증 코드 발송을 실제 API 또는 테스트용 구현으로 분리한다.
 */
public interface MailService {
    void sendVerificationCode(String email, String code, int expiresInSeconds);
}
