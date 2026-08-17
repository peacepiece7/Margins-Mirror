package com.margins.privacy.controller;

import com.margins.auth.support.AuthContext;
import com.margins.common.dto.ApiResponse;
import com.margins.privacy.dto.ConsentRequest;
import com.margins.privacy.dto.PrivacyConsentStatusResponse;
import com.margins.privacy.dto.PrivacyRequirementsResponse;
import com.margins.privacy.service.PrivacyConsentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/privacy")
@RequiredArgsConstructor
public class PrivacyController {
    private final PrivacyConsentService privacyConsentService;

    @GetMapping("/requirements")
    public ApiResponse<PrivacyRequirementsResponse> requirements() {
        return ApiResponse.ok(privacyConsentService.requirements());
    }

    @GetMapping("/consents")
    public ApiResponse<PrivacyConsentStatusResponse> consents(HttpServletRequest request) {
        return ApiResponse.ok(privacyConsentService.status(AuthContext.requireUserId(request)));
    }

    @PostMapping("/consents")
    public ApiResponse<PrivacyConsentStatusResponse> grant(
        @Valid @RequestBody ConsentRequest consent,
        HttpServletRequest request
    ) {
        Long userId = AuthContext.requireUserId(request);
        privacyConsentService.grant(userId, consent, "EXISTING", false);
        return ApiResponse.ok(privacyConsentService.status(userId));
    }
}
