package com.margins.auth.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * 메일 발송이 비활성화된 환경에서 사용하는 대체 구현체다.
 * 개발/테스트에서 외부 메일 API 없이 인증 흐름을 진행하게 한다.
 */
@Service
@ConditionalOnProperty(
    prefix = "margins.mail.verification",
    name = "enabled",
    havingValue = "false",
    matchIfMissing = true
)
public class NoopMailService implements MailService {

    @Override
    public void sendVerificationCode(String email, String code, int expiresInSeconds) {
        // local/test 기본값에서는 실제 외부 메일 API를 호출하지 않는다.
    }
}
