package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.auth.config.AuthCookieProperties;
import com.margins.auth.support.AuthCookieSupport;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthCookieSupportTest {

    private AuthCookieSupport cookieSupport;

    @BeforeEach
    void setUp() {
        AuthCookieProperties properties = new AuthCookieProperties();
        properties.setSecure(true);
        cookieSupport = new AuthCookieSupport(properties);
    }

    @Test
    void oauthStateCookieUsesLaxForGoogleTopLevelCallback() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        cookieSupport.writeOAuthStateCookie(response, "state-value", Duration.ofMinutes(10));

        assertThat(response.getHeader("Set-Cookie"))
            .contains("margins_oauth_state=state-value")
            .contains("Path=/api/auth")
            .contains("Secure")
            .contains("HttpOnly")
            .contains("SameSite=Lax");
    }

    @Test
    void refreshCookieRemainsStrict() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        cookieSupport.writeRefreshCookie(response, "refresh-value", Duration.ofDays(7));

        assertThat(response.getHeader("Set-Cookie"))
            .contains("margins_refresh=refresh-value")
            .contains("Path=/api/auth")
            .contains("Secure")
            .contains("HttpOnly")
            .contains("SameSite=Strict");
    }

    @Test
    void clearedCookiesKeepTheirCorrespondingSameSitePolicy() {
        MockHttpServletResponse oauthResponse = new MockHttpServletResponse();
        MockHttpServletResponse refreshResponse = new MockHttpServletResponse();

        cookieSupport.clearOAuthStateCookie(oauthResponse);
        cookieSupport.clearRefreshCookie(refreshResponse);

        assertThat(oauthResponse.getHeader("Set-Cookie"))
            .contains("Max-Age=0")
            .contains("SameSite=Lax");
        assertThat(refreshResponse.getHeader("Set-Cookie"))
            .contains("Max-Age=0")
            .contains("SameSite=Strict");
    }
}
