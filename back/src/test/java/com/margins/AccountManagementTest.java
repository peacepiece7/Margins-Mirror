package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.margins.account.business.AccountBusiness;
import com.margins.account.controller.AccountController;
import com.margins.account.mapper.AccountMapper;
import com.margins.account.service.AccountChallengeService;
import com.margins.account.service.AccountLifecycleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.dto.AuthPrincipal;
import com.margins.auth.model.UserRecord;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.service.RefreshTokenService;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.privacy.mapper.PrivacyRetentionMapper;
import com.margins.testsupport.TestAuthSupport;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

class AccountManagementTest {
    @Test
    void profileRequestOnlyAcceptsMutableDisplayName() {
        assertThat(AccountController.ProfileRequest.class.getRecordComponents())
            .extracting(component -> component.getName())
            .containsExactly("displayName", "preferredLocale");
    }

    @Test
    void profileUpdateChangesDisplayNameWithoutChangingLoginIdentityOrSession() {
        AccountMapper accountMapper = mock(AccountMapper.class);
        RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
        UserRecord user = TestAuthSupport.peacepieceUser();
        when(accountMapper.findUserById(user.getId())).thenReturn(Optional.of(user));
        when(accountMapper.updateProfile(user.getId(), "Reader Name", "en")).thenReturn(1);
        AccountBusiness business = new AccountBusiness(
            accountMapper,
            mock(AccountChallengeService.class),
            refreshTokens,
            mock(PasswordEncoder.class),
            mock(Environment.class),
            mock(PrivacyConsentService.class)
        );

        AccountBusiness.ProfileResult result = business.updateProfile(user.getId(), " Reader Name ", "en");

        verify(accountMapper).updateProfile(user.getId(), "Reader Name", "en");
        verifyNoInteractions(refreshTokens);
        assertThat(result.account().username()).isEqualTo(user.getUsername());
    }

    @Test
    void legacyProfileUpdatePreservesTheStoredLocale() {
        AccountMapper accountMapper = mock(AccountMapper.class);
        UserRecord user = TestAuthSupport.peacepieceUser();
        when(accountMapper.findUserById(user.getId())).thenReturn(Optional.of(user));
        when(accountMapper.updateProfile(user.getId(), "Reader Name", null)).thenReturn(1);
        AccountBusiness business = new AccountBusiness(
            accountMapper,
            mock(AccountChallengeService.class),
            mock(RefreshTokenService.class),
            mock(PasswordEncoder.class),
            mock(Environment.class),
            mock(PrivacyConsentService.class)
        );

        business.updateProfile(user.getId(), "Reader Name", null);

        verify(accountMapper).updateProfile(user.getId(), "Reader Name", null);
    }

    @Test
    void accessTokenCarriesCredentialsVersion() {
        JwtTokenService service = tokenService();
        UserRecord user = TestAuthSupport.peacepieceUser();

        AuthPrincipal principal = service.validate(service.createAccessToken(user)).orElseThrow();

        assertThat(principal.getCredentialsVersion()).isEqualTo(1L);
    }

    @Test
    void purgedOrResignedStateIsNotAnActiveAccountState() {
        UserRecord resigned = UserRecord.builder().accountStatus("RESIGNED").build();
        UserRecord purged = UserRecord.builder().accountStatus("PURGED").build();

        assertThat(resigned.getAccountStatus()).isNotEqualTo("ACTIVE");
        assertThat(purged.getAccountStatus()).isNotEqualTo("ACTIVE");
    }

    @Test
    void resignationRecordsRequiredConsentWithdrawals() {
        AccountMapper accountMapper = mock(AccountMapper.class);
        AccountChallengeService challenges = mock(AccountChallengeService.class);
        RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
        PrivacyConsentService privacy = mock(PrivacyConsentService.class);
        UserRecord user = TestAuthSupport.peacepieceUser();
        when(accountMapper.findUserById(user.getId())).thenReturn(Optional.of(user));
        when(accountMapper.resign(
            org.mockito.ArgumentMatchers.eq(user.getId()),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        )).thenReturn(1);
        AccountBusiness business = new AccountBusiness(
            accountMapper,
            challenges,
            refreshTokens,
            mock(PasswordEncoder.class),
            mock(Environment.class),
            privacy
        );

        business.resign(user.getId(), "action-token", null);

        verify(challenges).consume("action-token", AccountChallengeService.RESIGNATION, user.getId());
        verify(privacy).recordWithdrawals(user.getId(), "RESIGNATION", user.isTestData());
        verify(refreshTokens).revokeAllForUser(user.getId());
    }

    @Test
    void eraseAllDeletesLinkableModerationEventsBeforeParentActivity() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AccountLifecycleService lifecycle = new AccountLifecycleService(
            mock(AccountMapper.class),
            jdbc,
            mock(Environment.class),
            mock(TransactionTemplate.class),
            mock(PrivacyRetentionMapper.class)
        );

        ReflectionTestUtils.invokeMethod(lifecycle, "deleteAllActivity", 1L);

        verify(jdbc).update("DELETE FROM moderation_events WHERE user_id=?", 1L);
        verify(jdbc).update(
            "DELETE FROM messages WHERE user_id=? OR session_id IN (SELECT id FROM reading_sessions WHERE user_id=?)",
            1L,
            1L
        );
    }

    private JwtTokenService tokenService() {
        AuthJwtProperties properties = new AuthJwtProperties();
        properties.setIssuer("margins-test");
        properties.setSecret("test-secret");
        properties.setAccessTtlSeconds(60);
        return new JwtTokenService(properties, new ObjectMapper());
    }
}
