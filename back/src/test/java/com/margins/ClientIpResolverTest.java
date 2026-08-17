package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.auth.support.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

class ClientIpResolverTest {
    private final ClientIpResolver resolver = new ClientIpResolver();

    @Test
    void trustsRealIpOnlyFromLoopbackReverseProxy() {
        HttpServletRequest proxied = request("127.0.0.1", "203.0.113.9", "198.51.100.2");
        assertThat(resolver.resolve(proxied)).isEqualTo("203.0.113.9");

        HttpServletRequest direct = request("198.51.100.7", "203.0.113.10", "203.0.113.11");
        assertThat(resolver.resolve(direct)).isEqualTo("198.51.100.7");
    }

    @Test
    void ignoresForwardedForAndRejectsInvalidRealIp() {
        HttpServletRequest request = request("::1", "attacker.example", "203.0.113.12");
        assertThat(resolver.resolve(request)).isNotEqualTo("203.0.113.12");
        assertThat(resolver.resolve(request)).isIn("0:0:0:0:0:0:0:1", "::1");
    }

    private HttpServletRequest request(String remote, String realIp, String forwardedFor) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn(remote);
        when(request.getHeader("X-Real-IP")).thenReturn(realIp);
        when(request.getHeader("X-Forwarded-For")).thenReturn(forwardedFor);
        return request;
    }
}
