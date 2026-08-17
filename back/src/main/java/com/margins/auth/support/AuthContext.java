package com.margins.auth.support;

import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.security.MarginsUserPrincipal;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class AuthContext {

    private AuthContext() {
    }

    public static Long requireUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof MarginsUserPrincipal principal) {
            return principal.getUserId();
        }

        throw new ApiException(ApiErrorCode.COMMON_UNAUTHORIZED);
    }

    public static Long requireUserId(HttpServletRequest request) {
        Object attribute = request.getAttribute(JwtAuthenticationFilter.USER_ID_ATTRIBUTE);
        if (attribute instanceof Long userId) {
            return userId;
        }

        return requireUserId();
    }
}
