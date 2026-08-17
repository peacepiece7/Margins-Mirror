package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
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
import com.margins.auth.service.EmailVerificationRateLimitException;
import com.margins.auth.service.EmailVerificationService;
import com.margins.auth.service.MailDeliveryException;
import com.margins.auth.service.MailService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.common.controller.ApiExceptionHandler;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class EmailVerificationAbuseProtectionTest {
    private final AuthEmailVerificationMapper verificationMapper =
        mock(AuthEmailVerificationMapper.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final MailService mailService = mock(MailService.class);
    private final BotChallengeVerifier challengeVerifier = mock(BotChallengeVerifier.class);
    private final EmailVerificationRateLimitService rateLimitService =
        mock(EmailVerificationRateLimitService.class);
    private EmailVerificationService service;

    @BeforeEach
    void setUp() {
        MailVerificationProperties mail = new MailVerificationProperties();
        mail.setTtlSeconds(300);
        EmailVerificationAbuseProperties abuse = new EmailVerificationAbuseProperties();
        abuse.setResendAfterSeconds(60);
        when(userMapper.findByEmail(anyString())).thenReturn(Optional.empty());
        service = new EmailVerificationService(
            verificationMapper,
            userMapper,
            mailService,
            mail,
            new MockEnvironment().withProperty("spring.profiles.active", "test"),
            challengeVerifier,
            rateLimitService,
            abuse
        );
    }

    @Test
    void invalidChallengeCreatesNoCodeAndSendsNoMail() {
        doThrow(new ApiException(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID))
            .when(challengeVerifier).verify("bad-token", "203.0.113.4");

        assertThatThrownBy(() -> service.issueCode(
            "Reader@Example.com", "bad-token", "203.0.113.4"))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(ApiErrorCode.AUTH_BOT_CHALLENGE_INVALID));

        verify(rateLimitService).precheck("reader@example.com", "203.0.113.4");
        verify(rateLimitService, never()).reserve(anyString(), anyString());
        verify(verificationMapper, never()).insert(any());
        verify(mailService, never()).sendVerificationCode(anyString(), anyString(), anyInt());
    }

    @Test
    void successfulIssueReservesBeforeMailAndReturnsServerCooldown() {
        var response = service.issueCode("Reader@Example.com", "valid-token", "203.0.113.4");

        assertThat(response.getEmail()).isEqualTo("reader@example.com");
        assertThat(response.getResendAfterSeconds()).isEqualTo(60);
        verify(rateLimitService).reserve("reader@example.com", "203.0.113.4");
        verify(verificationMapper).insert(any());
        verify(mailService).sendVerificationCode(anyString(), anyString(), anyInt());
    }

    @Test
    void mailFailureInvalidatesCodeButDoesNotUndoReservation() {
        doThrow(new MailDeliveryException("provider failed"))
            .when(mailService).sendVerificationCode(anyString(), anyString(), anyInt());

        assertThatThrownBy(() -> service.issueCode(
            "reader@example.com", "valid-token", "203.0.113.4"))
            .isInstanceOf(MailDeliveryException.class);

        verify(rateLimitService).reserve("reader@example.com", "203.0.113.4");
        verify(verificationMapper, org.mockito.Mockito.times(2))
            .expireActiveForEmail("reader@example.com");
    }

    @Test
    void rateLimitResponseIncludesRetryAfterWithoutInternalDetails() {
        var response = new ApiExceptionHandler()
            .handleEmailVerificationRateLimit(new EmailVerificationRateLimitException(17));

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("17");
        assertThat(response.getBody().getError().getCode())
            .isEqualTo(ApiErrorCode.AUTH_EMAIL_VERIFICATION_RATE_LIMITED);
    }
}
