package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.filter.JwtAuthenticationFilter;
import com.margins.auth.service.JwtTokenService;
import com.margins.auth.model.UserRecord;
import com.margins.auth.mapper.UserMapper;
import com.margins.privacy.service.PrivacyConsentService;
import com.margins.testsupport.TestAuthSupport;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

class JwtAuthenticationFilterTest {

    @Test
    void allowsProtectedApiWithValidBearerToken() throws ServletException, IOException {
        JwtTokenService tokenService = tokenService();
        UserRecord user = TestAuthSupport.demo_readerUser();
        UserMapper userMapper = mock(UserMapper.class);
        when(userMapper.findById(1L)).thenReturn(Optional.of(user));
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
            tokenService, userMapper, new ObjectMapper(), mock(PrivacyConsentService.class));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/reading-sessions/latest");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + tokenService.createAccessToken(user));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
        assertThat(request.getAttribute(JwtAuthenticationFilter.USER_ID_ATTRIBUTE)).isEqualTo(1L);
        assertThat(request.getAttribute(JwtAuthenticationFilter.USERNAME_ATTRIBUTE)).isEqualTo("demo_reader");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }

    @Test
    void blocksMainApiWith428WhenCurrentConsentIsMissing() throws ServletException, IOException {
        JwtTokenService tokenService = tokenService();
        UserRecord user = TestAuthSupport.demo_readerUser();
        UserMapper userMapper = mock(UserMapper.class);
        PrivacyConsentService privacy = mock(PrivacyConsentService.class);
        when(userMapper.findById(1L)).thenReturn(Optional.of(user));
        when(privacy.hasCurrentRequiredConsents(1L)).thenReturn(false);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
            tokenService, userMapper, new ObjectMapper(), privacy);
        ReflectionTestUtils.setField(filter, "privacyEnforcementEnabled", true);
        MockHttpServletRequest request = authenticatedRequest(
            tokenService, user, "GET", "/api/reading-sessions/latest");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(428);
        assertThat(response.getContentAsString())
            .contains("\"code\":\"PRIVACY_CONSENT_REQUIRED\"")
            .doesNotContain("required consents missing", "\"message\"");
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void allowsOnlyExplicitAccountEndpointsWhileConsentIsPending() throws ServletException, IOException {
        JwtTokenService tokenService = tokenService();
        UserRecord user = TestAuthSupport.demo_readerUser();
        UserMapper userMapper = mock(UserMapper.class);
        PrivacyConsentService privacy = mock(PrivacyConsentService.class);
        when(userMapper.findById(1L)).thenReturn(Optional.of(user));
        when(privacy.hasCurrentRequiredConsents(1L)).thenReturn(false);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
            tokenService, userMapper, new ObjectMapper(), privacy);
        ReflectionTestUtils.setField(filter, "privacyEnforcementEnabled", true);

        assertPendingRequestAllowed(filter, authenticatedRequest(tokenService, user, "GET", "/api/account"));
        assertPendingRequestAllowed(filter,
            authenticatedRequest(tokenService, user, "POST", "/api/account/resignation"));

        MockHttpServletRequest recovery = authenticatedRequest(
            tokenService, user, "POST", "/api/account/recovery");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(recovery, response, new MockFilterChain());
        assertThat(response.getStatus()).isEqualTo(428);
    }

    @Test
    void sameAccessTokenIsAllowedImmediatelyAfterCurrentConsentIsRecorded() throws ServletException, IOException {
        JwtTokenService tokenService = tokenService();
        UserRecord user = TestAuthSupport.demo_readerUser();
        UserMapper userMapper = mock(UserMapper.class);
        PrivacyConsentService privacy = mock(PrivacyConsentService.class);
        when(userMapper.findById(1L)).thenReturn(Optional.of(user));
        when(privacy.hasCurrentRequiredConsents(1L)).thenReturn(false, true);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
            tokenService, userMapper, new ObjectMapper(), privacy);
        ReflectionTestUtils.setField(filter, "privacyEnforcementEnabled", true);

        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(
            authenticatedRequest(tokenService, user, "GET", "/api/books"),
            blocked,
            new MockFilterChain()
        );
        assertThat(blocked.getStatus()).isEqualTo(428);

        MockHttpServletRequest grantedRequest = authenticatedRequest(tokenService, user, "GET", "/api/books");
        MockHttpServletResponse granted = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(grantedRequest, granted, chain);
        assertThat(granted.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(grantedRequest);
    }

  @Test
  void passesThroughWhenBearerTokenMissing() throws ServletException, IOException {
    JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
        tokenService(), mock(UserMapper.class), new ObjectMapper(), mock(PrivacyConsentService.class));
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/reading-sessions/latest");
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain chain = new MockFilterChain();

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(200);
    assertThat(chain.getRequest()).isSameAs(request);
  }

    private JwtTokenService tokenService() {
        AuthJwtProperties properties = new AuthJwtProperties();
        properties.setIssuer("margins-test");
        properties.setSecret("test-secret");
        properties.setAccessTtlSeconds(60);

        return new JwtTokenService(properties, new ObjectMapper());
    }

    private MockHttpServletRequest authenticatedRequest(
        JwtTokenService tokenService,
        UserRecord user,
        String method,
        String path
    ) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + tokenService.createAccessToken(user));
        return request;
    }

    private void assertPendingRequestAllowed(
        JwtAuthenticationFilter filter,
        MockHttpServletRequest request
    ) throws ServletException, IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
    }
}
