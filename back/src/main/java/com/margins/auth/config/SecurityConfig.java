package com.margins.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.filter.JwtAuthenticationFilter;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.ObjectPostProcessor;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.HeaderWriterFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;
    @Value("${margins.cors.allowed-origin:http://localhost:5173}")
    private String corsAllowedOrigin;

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(java.util.List.of(corsAllowedOrigin));
        configuration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "X-CSRF-Token"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .headers(headers -> headers.withObjectPostProcessor(
                new ObjectPostProcessor<HeaderWriterFilter>() {
                    @Override
                    public <O extends HeaderWriterFilter> O postProcess(O filter) {
                        filter.setShouldWriteHeadersEagerly(true);
                        return filter;
                    }
                }
            ))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/contact-inquiries").permitAll()
                .requestMatchers(
                    "/api/auth/login",
                    "/api/auth/registration-intents",
                    "/api/auth/register",
                    "/api/auth/email-verifications",
                    "/api/auth/email-verifications/confirm",
                    "/api/auth/email-availability",
                    "/api/auth/refresh",
                    "/api/auth/oauth/**",
                    "/api/privacy/requirements",
                    "/api/account/recovery/challenges",
                    "/api/account/recovery/challenges/*/verify",
                    "/api/account/recovery",
                    "/api/health",
                    "/api/test/**",
                    "/v3/api-docs/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(handler -> handler.authenticationEntryPoint((request, response, exception) ->
                JwtAuthenticationFilter.writeUnauthorized(response, objectMapper)
            ))
            //
            // JWT Filter를 Spring Security Filter Chain에 등록하고,
            // UsernamePasswordAuthenticationFilter 앞에서 실행해라.
            /*
             * HTTP Request
             *         │
             *         ▼
             * JwtAuthenticationFilter
             *         │
             *         │ JWT 검증
             *         │ Authentication 생성
             *         ▼
             * SecurityContextHolder
             *         │
             *         ▼
             * AuthorizationFilter
             * (authorizeHttpRequests)
             *         │
             *         │ permitAll?
             *         │ authenticated?
             *         ▼
             * Controller
             */
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
