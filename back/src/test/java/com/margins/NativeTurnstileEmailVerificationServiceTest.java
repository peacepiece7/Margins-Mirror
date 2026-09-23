package com.margins;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.mapper.AuthEmailVerificationMapper;
import com.margins.auth.mapper.UserMapper;
import com.margins.auth.service.BotChallengeVerifier;
import com.margins.auth.service.EmailVerificationRateLimitService;
import com.margins.auth.service.EmailVerificationService;
import com.margins.auth.service.MailService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.mock.env.MockEnvironment;

class NativeTurnstileEmailVerificationServiceTest {
    @Test
    void verifiedBridgePathSkipsSecondChallengeAndPreservesAbuseAndMailOrder() {
        AuthEmailVerificationMapper verificationMapper = mock(AuthEmailVerificationMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        MailService mailService = mock(MailService.class);
        BotChallengeVerifier challengeVerifier = mock(BotChallengeVerifier.class);
        EmailVerificationRateLimitService rateLimitService = mock(EmailVerificationRateLimitService.class);
        MailVerificationProperties mailProperties = new MailVerificationProperties();
        mailProperties.setTtlSeconds(300);
        EmailVerificationAbuseProperties abuseProperties = new EmailVerificationAbuseProperties();
        abuseProperties.setResendAfterSeconds(60);
        when(userMapper.findByEmail("reader@example.com")).thenReturn(Optional.empty());
        EmailVerificationService service = new EmailVerificationService(
            verificationMapper,
            userMapper,
            mailService,
            mailProperties,
            new MockEnvironment().withProperty("spring.profiles.active", "test"),
            challengeVerifier,
            rateLimitService,
            abuseProperties
        );

        service.issueCodeAfterVerifiedBotChallenge("Reader@Example.com", "203.0.113.4");

        verify(challengeVerifier, never()).verify(any(), any());
        InOrder ordered = inOrder(userMapper, rateLimitService, verificationMapper, mailService);
        ordered.verify(userMapper).findByEmail("reader@example.com");
        ordered.verify(rateLimitService).precheck("reader@example.com", "203.0.113.4");
        ordered.verify(rateLimitService).reserve("reader@example.com", "203.0.113.4");
        ordered.verify(verificationMapper).expireActiveForEmail("reader@example.com");
        ordered.verify(verificationMapper).insert(any());
        ordered.verify(mailService).sendVerificationCode(
            org.mockito.ArgumentMatchers.eq("reader@example.com"),
            org.mockito.ArgumentMatchers.matches("\\d{6}"),
            org.mockito.ArgumentMatchers.eq(300)
        );
    }
}
