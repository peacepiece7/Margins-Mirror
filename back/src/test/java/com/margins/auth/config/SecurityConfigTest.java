package com.margins.auth.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.filter.JwtAuthenticationFilter;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

class SecurityConfigTest {

    @Test
    void corsAllowsOnlyTheConfiguredExactOriginWithCredentials() {
        SecurityConfig securityConfig = new SecurityConfig(
            mock(JwtAuthenticationFilter.class),
            new ObjectMapper()
        );
        ReflectionTestUtils.setField(
            securityConfig,
            "corsAllowedOrigin",
            "https://margins.cloud"
        );
        CorsConfigurationSource source = securityConfig.corsConfigurationSource();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/books");

        CorsConfiguration configuration = source.getCorsConfiguration(request);

        assertThat(configuration).isNotNull();
        assertThat(configuration.getAllowedOrigins()).containsExactly("https://margins.cloud");
        assertThat(configuration.getAllowCredentials()).isTrue();
        assertThat(configuration.getAllowedMethods())
            .containsExactlyElementsOf(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        assertThat(configuration.getAllowedHeaders())
            .containsExactlyElementsOf(List.of("Authorization", "Content-Type", "X-CSRF-Token"));
        assertThat(configuration.checkOrigin("https://margins.cloud"))
            .isEqualTo("https://margins.cloud");
        assertThat(configuration.checkOrigin("https://dev.margins.cloud")).isNull();
    }
}
