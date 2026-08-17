package com.margins.auth.support;

import com.margins.auth.config.AuthCookieProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthCookieSupport {

    private final AuthCookieProperties properties;

    public void writeRefreshCookie(HttpServletResponse response, String refreshToken, Duration maxAge) {
        ResponseCookie cookie = baseCookie(properties.getRefreshName(), maxAge, properties.getRefreshSameSite())
            .value(refreshToken)
            .httpOnly(true)
            .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    public void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = baseCookie(properties.getRefreshName(), Duration.ZERO, properties.getRefreshSameSite())
            .value("")
            .httpOnly(true)
            .maxAge(0)
            .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    public void writeOAuthStateCookie(HttpServletResponse response, String state, Duration maxAge) {
        ResponseCookie cookie = baseCookie(properties.getOauthStateName(), maxAge, properties.getOauthStateSameSite())
            .value(state)
            .httpOnly(true)
            .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    public void clearOAuthStateCookie(HttpServletResponse response) {
        ResponseCookie cookie = baseCookie(properties.getOauthStateName(), Duration.ZERO, properties.getOauthStateSameSite())
            .value("")
            .httpOnly(true)
            .maxAge(0)
            .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    public void writeRegistrationIntentCookie(HttpServletResponse response, String token, Duration maxAge) {
        writeStrictCookie(response, properties.getRegistrationIntentName(), token, maxAge);
    }

    public void clearRegistrationIntentCookie(HttpServletResponse response) {
        writeStrictCookie(response, properties.getRegistrationIntentName(), "", Duration.ZERO);
    }

    public void writeGoogleRegistrationCookie(HttpServletResponse response, String token, Duration maxAge) {
        writeStrictCookie(response, properties.getGoogleRegistrationName(), token, maxAge);
    }

    public void clearGoogleRegistrationCookie(HttpServletResponse response) {
        writeStrictCookie(response, properties.getGoogleRegistrationName(), "", Duration.ZERO);
    }

    private void writeStrictCookie(HttpServletResponse response, String name, String value, Duration maxAge) {
        ResponseCookie cookie = baseCookie(name, maxAge, "Strict")
            .value(value)
            .httpOnly(true)
            .maxAge(maxAge)
            .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    public String readCookieValue(Cookie[] cookies, String name) {
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String name, Duration maxAge, String sameSite) {
        return ResponseCookie.from(name, "")
            .path(properties.getPath())
            .secure(properties.isSecure())
            .sameSite(sameSite)
            .maxAge(maxAge);
    }
}
