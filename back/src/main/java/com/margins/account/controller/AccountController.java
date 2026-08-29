package com.margins.account.controller;

import com.margins.account.business.AccountBusiness;
import com.margins.account.business.AccountBusiness.*;
import com.margins.account.service.AccountChallengeService;
import com.margins.account.service.AccountChallengeService.*;
import com.margins.auth.model.UserRecord;
import com.margins.auth.support.AuthContext;
import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {
    private final AccountBusiness accountBusiness;
    private final AccountChallengeService challengeService;

    @GetMapping
    public ApiResponse<AccountView> account() {
        return ApiResponse.ok(accountBusiness.getAccount(AuthContext.requireUserId()));
    }

    @PatchMapping("/profile")
    public ApiResponse<ProfileResult> profile(@Valid @RequestBody ProfileRequest request) {
        return ApiResponse.ok(accountBusiness.updateProfile(
            AuthContext.requireUserId(), request.displayName(), request.preferredLocale()));
    }

    @PatchMapping("/password")
    public ApiResponse<Void> password(@Valid @RequestBody PasswordRequest request) {
        accountBusiness.changePassword(AuthContext.requireUserId(), request.currentPassword(),
            request.newPassword(), request.confirmPassword());
        return ApiResponse.ok(null);
    }

    @PostMapping("/resignation/challenges")
    public ApiResponse<ChallengeIssued> resignationChallenge(HttpServletRequest request) {
        UserRecord user = accountBusiness.activeUser(AuthContext.requireUserId());
        return ApiResponse.ok(challengeService.issueForUser(user,
            AccountChallengeService.RESIGNATION, request.getRemoteAddr()));
    }

    @PostMapping("/resignation/challenges/{id}/verify")
    public ApiResponse<VerificationResult> verifyResignation(@PathVariable String id,
        @Valid @RequestBody VerifyRequest request) {
        return ApiResponse.ok(challengeService.verify(id, AccountChallengeService.RESIGNATION, request.code()));
    }

    @PostMapping("/resignation")
    public ApiResponse<Void> resign(@Valid @RequestBody ResignationRequest request) {
        accountBusiness.resign(AuthContext.requireUserId(), request.actionToken(),
            request.survey() == null ? null : request.survey().toDomain());
        return ApiResponse.ok(null);
    }

    @PostMapping("/recovery/challenges")
    public ApiResponse<ChallengeIssued> recoveryChallenge(@Valid @RequestBody RecoveryChallengeRequest body,
        HttpServletRequest request) {
        UserRecord user = accountBusiness.findRecoverableByEmail(body.email());
        if (user == null) return ApiResponse.ok(new ChallengeIssued(challengeService.neutralChallengeId(), 300, null));
        try {
            return ApiResponse.ok(challengeService.issueForUser(user,
                AccountChallengeService.RECOVERY, request.getRemoteAddr()));
        } catch (RuntimeException ignored) {
            return ApiResponse.ok(new ChallengeIssued(challengeService.neutralChallengeId(), 300, null));
        }
    }

    @PostMapping("/recovery/challenges/{id}/verify")
    public ApiResponse<VerificationResult> verifyRecovery(@PathVariable String id,
        @Valid @RequestBody VerifyRequest request) {
        return ApiResponse.ok(challengeService.verify(id, AccountChallengeService.RECOVERY, request.code()));
    }

    @PostMapping("/recovery")
    public ApiResponse<Void> recover(@Valid @RequestBody RecoveryRequest request) {
        accountBusiness.recover(request.email(), request.actionToken(), request.action());
        return ApiResponse.ok(null);
    }

    public record ProfileRequest(@NotBlank @Size(max=120) String displayName,
        @Pattern(regexp="ko|en") String preferredLocale) {}
    public record PasswordRequest(@NotBlank String currentPassword,
        @NotBlank @Size(min=10,max=128) String newPassword, @NotBlank String confirmPassword) {}
    public record VerifyRequest(@Pattern(regexp="^[0-9]{6}$") String code) {}
    public record RecoveryChallengeRequest(@Email @NotBlank String email) {}
    public record RecoveryRequest(@Email @NotBlank String email, @NotBlank String actionToken,
        @Pattern(regexp="RESTORE|ERASE_ALL_ACTIVITY") String action) {}
    public record ResignationRequest(@NotBlank String actionToken, @Valid ExitSurveyRequest survey) {}
    public record ExitSurveyRequest(
        @Pattern(regexp="NOT_USING|MISSING_FEATURES|TOO_MANY_ERRORS|PRIVACY_CONCERNS|OTHER") String reason,
        @Size(max=30) String gender, @Size(max=80) String genderText, @Size(max=20) String ageBand,
        @Pattern(regexp="^[A-Za-z]{2}$") String countryCode, @Size(max=120) String region,
        @Size(max=500) String otherText) {
        ExitSurvey toDomain() {
            if (reason == null) throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST);
            return new ExitSurvey(reason, gender, genderText, ageBand, countryCode, region, otherText);
        }
    }
}
