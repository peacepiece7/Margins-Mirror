package com.margins.account.business;

import com.margins.account.mapper.AccountMapper;
import com.margins.account.service.AccountChallengeService;
import com.margins.auth.model.UserRecord;
import com.margins.auth.service.RefreshTokenService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.privacy.service.PrivacyConsentService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class AccountBusiness {
    private final AccountMapper accountMapper;
    private final AccountChallengeService challengeService;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;
    private final PrivacyConsentService privacyConsentService;

    public AccountView getAccount(Long userId) {
        return AccountView.from(activeUser(userId));
    }

    @Transactional
    public ProfileResult updateProfile(Long userId, String displayName, String preferredLocale) {
        activeUser(userId);
        String normalizedDisplayName = required(displayName, "display name");
        String normalizedLocale = preferredLocale == null ? null : normalizeLocale(preferredLocale);
        if (accountMapper.updateProfile(userId, normalizedDisplayName, normalizedLocale) != 1) {
            throw conflict("account state changed");
        }
        return new ProfileResult(AccountView.from(activeUser(userId)));
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword, String confirmation) {
        UserRecord user = activeUser(userId);
        if (!"local".equals(user.getAuthProvider()) || user.getPasswordHash() == null) {
            throw new ApiException(ApiErrorCode.ACCOUNT_PASSWORD_CHANGE_UNAVAILABLE);
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ApiException(ApiErrorCode.ACCOUNT_CURRENT_PASSWORD_INVALID);
        }
        if (!newPassword.equals(confirmation) || newPassword.length() < 10) {
            throw new ApiException(ApiErrorCode.ACCOUNT_PASSWORD_CONFIRMATION_INVALID);
        }
        accountMapper.updatePassword(userId, passwordEncoder.encode(newPassword));
        refreshTokenService.revokeAllForUser(userId);
    }

    @Transactional
    public void resign(Long userId, String actionToken, ExitSurvey survey) {
        UserRecord user = activeUser(userId);
        challengeService.consume(actionToken, AccountChallengeService.RESIGNATION, userId);
        Instant now = Instant.now();
        Instant purgeAt = now.plus(30, ChronoUnit.DAYS);
        if (accountMapper.resign(userId, now, purgeAt) != 1) throw conflict("account state changed");
        refreshTokenService.revokeAllForUser(userId);
        privacyConsentService.recordWithdrawals(userId, "RESIGNATION", user.isTestData());
        accountMapper.insertLifecycleEvent(userId, "RESIGNED", "SUCCESS", now, purgeAt);
        if (survey != null) {
            accountMapper.insertExitSurvey(survey.reason(), survey.gender(), survey.genderText(),
                survey.ageBand(), upper(survey.countryCode()), survey.region(), survey.otherText(),
                environment.acceptsProfiles(Profiles.of("local", "test")));
        }
    }

    @Transactional
    public void recover(String email, String actionToken, String action) {
        UserRecord user = accountMapper.findUserByEmail(email.trim().toLowerCase(Locale.ROOT))
            .filter(value -> "RESIGNED".equals(value.getAccountStatus()))
            .orElseThrow(() -> new ApiException(ApiErrorCode.ACCOUNT_RECOVERY_INVALID));
        challengeService.consume(actionToken, AccountChallengeService.RECOVERY, user.getId());
        Instant now = Instant.now();
        if ("RESTORE".equals(action)) {
            if (accountMapper.restore(user.getId(), now) != 1) throw conflict("recovery period expired");
            accountMapper.insertLifecycleEvent(user.getId(), "RESTORED", "SUCCESS", now, null);
        } else if ("ERASE_ALL_ACTIVITY".equals(action)) {
            if (accountMapper.scheduleActivityErase(user.getId(), now) != 1) throw conflict("recovery period expired");
            accountMapper.insertLifecycleEvent(user.getId(), "ERASE_REQUESTED", "SUCCESS", now,
                user.getPersonalDataPurgeScheduledAt());
        } else {
            throw new ApiException(ApiErrorCode.ACCOUNT_RECOVERY_INVALID);
        }
    }

    public UserRecord activeUser(Long userId) {
        return accountMapper.findUserById(userId)
            .filter(user -> "ACTIVE".equals(user.getAccountStatus()))
            .orElseThrow(() -> new ApiException(ApiErrorCode.ACCOUNT_INACTIVE));
    }

    public UserRecord findRecoverableByEmail(String email) {
        if (email == null) return null;
        return accountMapper.findUserByEmail(email.trim().toLowerCase(Locale.ROOT))
            .filter(user -> "RESIGNED".equals(user.getAccountStatus()))
            .filter(user -> user.getPersonalDataPurgeScheduledAt() != null
                && user.getPersonalDataPurgeScheduledAt().isAfter(Instant.now()))
            .orElse(null);
    }

    private String required(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, label + " is required");
        }
        return value.trim();
    }
    private String upper(String value) { return value == null ? null : value.toUpperCase(Locale.ROOT); }
    private ApiException conflict(String message) {
        return new ApiException(ApiErrorCode.COMMON_CONFLICT, message);
    }

    public record AccountView(Long userId, String username, String displayName, String email,
        String authProvider, String accountStatus, String preferredLocale) {
        static AccountView from(UserRecord user) {
            return new AccountView(user.getId(), user.getUsername(), user.getDisplayName(), user.getEmail(),
                user.getAuthProvider(), user.getAccountStatus(), normalizeLocale(user.getPreferredLocale()));
        }
    }
    private static String normalizeLocale(String preferredLocale) {
        return "ko".equals(preferredLocale) ? "ko" : "en";
    }
    public record ProfileResult(AccountView account) {}
    public record ExitSurvey(String reason, String gender, String genderText, String ageBand,
        String countryCode, String region, String otherText) {}
}
