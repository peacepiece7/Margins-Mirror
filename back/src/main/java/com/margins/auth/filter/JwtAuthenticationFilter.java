package com.margins.auth.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.security.MarginsUserPrincipal;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.mapper.UserMapper;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.common.dto.ApiResponse;
import com.margins.common.error.ApiErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 요청의 Bearer JWT를 검증해 Spring Security 인증 컨텍스트를 채운다.
 * 토큰이 없으면 통과시키고, 유효하지 않으면 인증 상태를 비운다.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String USER_ID_ATTRIBUTE = "margins.userId";
    public static final String USERNAME_ATTRIBUTE = "margins.username";

    private final JwtTokenService jwtTokenService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final PrivacyConsentService privacyConsentService;

    @Value("${margins.privacy.enforcement-enabled:false}")
    private boolean privacyEnforcementEnabled;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        jwtTokenService.validate(header.substring("Bearer ".length()))
            .filter(principal -> userMapper.findById(principal.getUserId())
                .filter(user -> "ACTIVE".equals(user.getAccountStatus()))
                .filter(user -> user.getCredentialsVersion() == principal.getCredentialsVersion()) // 기존인증수단 무효화 버전 체크
                .isPresent())
            .ifPresentOrElse(principal -> {
                boolean consentRequired = privacyEnforcementEnabled
                    && !privacyConsentService.hasCurrentRequiredConsents(principal.getUserId());
                MarginsUserPrincipal userPrincipal = new MarginsUserPrincipal(
                    principal.getUserId(),
                    principal.getUsername(),
                    principal.getDisplayName(),
                    principal.getAuthProvider(),
                    consentRequired
                );
                // 현재 요청을 인증된 사용자로 등록
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userPrincipal, // 사용자 정보
                    null, // 비밀번호 등. 인증 후에는 보통 제거
                    userPrincipal.getAuthorities() // 권한 목록

                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
                //  Authentication auth =  SecurityContextHolder.getContext().getAuthentication();
                //  auth.getPrincipal();

                request.setAttribute(USER_ID_ATTRIBUTE, principal.getUserId());
                request.setAttribute(USERNAME_ATTRIBUTE, principal.getUsername());
                request.setAttribute("margins.consentRequired", consentRequired);
            }, SecurityContextHolder::clearContext);

        if (Boolean.TRUE.equals(request.getAttribute("margins.consentRequired"))
            && !isConsentPendingAllowed(request)) {
            writeConsentRequired(response, objectMapper);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isConsentPendingAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/privacy/")
            || path.equals("/api/auth/logout")
            || isConsentPendingAccountAllowed(request.getMethod(), path);
    }

    private boolean isConsentPendingAccountAllowed(String method, String path) {
        if ("GET".equals(method) && path.equals("/api/account")) return true;
        if ("PATCH".equals(method) && (path.equals("/api/account/profile") || path.equals("/api/account/password"))) {
            return true;
        }
        return "POST".equals(method) && (
            path.equals("/api/account/resignation")
                || path.equals("/api/account/resignation/challenges")
                || path.matches("/api/account/resignation/challenges/[^/]+/verify")
        );
    }

    public static void writeConsentRequired(HttpServletResponse response, ObjectMapper objectMapper) {
        try {
            response.setStatus(HttpStatus.PRECONDITION_REQUIRED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(), ApiResponse.failed(ApiErrorCode.PRIVACY_CONSENT_REQUIRED));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to write consent-required response", exception);
        }
    }

    public static void writeUnauthorized(HttpServletResponse response, ObjectMapper objectMapper) {
        try {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(), ApiResponse.failed(ApiErrorCode.COMMON_UNAUTHORIZED));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to write unauthorized response", exception);
        }
    }
}
