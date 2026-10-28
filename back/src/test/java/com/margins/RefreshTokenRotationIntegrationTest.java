package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.auth.model.UserRecord;
import com.margins.auth.service.RefreshTokenService;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationFixtureSupport;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class RefreshTokenRotationIntegrationTest extends AbstractMySqlIntegrationTest {

    private static final int CONCURRENT_ATTEMPTS = 16;

    @Autowired RefreshTokenService refreshTokenService;
    @Autowired JdbcTemplate jdbc;

    private UserRecord user;

    @BeforeEach
    void resetTokensAndUser() throws Exception {
        IntegrationFixtureSupport.resetSessionGraph(dataSource);
        user = UserRecord.builder()
            .id(1L)
            .username("peacepiece")
            .displayName("peacepiece")
            .email("peacepiece@test.margins.local")
            .emailVerified(true)
            .preferredLocale("en")
            .authProvider("local")
            .accountStatus("ACTIVE")
            .testData(true)
            .build();
    }

    @Test
    void concurrentReplayIssuesExactlyOneDescendantRefreshToken() throws Exception {
        String original = refreshTokenService.issue(user).rawToken();
        AtomicInteger rotations = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(CONCURRENT_ATTEMPTS)) {
            var futures = java.util.stream.IntStream.range(0, CONCURRENT_ATTEMPTS)
                .mapToObj(index -> executor.submit(() -> {
                    start.await();
                    Optional<RefreshTokenService.RotationResult> result = refreshTokenService.rotate(
                        original,
                        userId -> Optional.of(user)
                    );
                    if (result.isPresent()) {
                        rotations.incrementAndGet();
                    }
                    return null;
                }))
                .toList();

            start.countDown();
            for (var future : futures) {
                future.get();
            }
        }

        assertThat(rotations).hasValue(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM refresh_tokens", Integer.class))
            .isEqualTo(2);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM refresh_tokens WHERE revoked_at IS NULL",
            Integer.class
        )).isEqualTo(1);
    }
}
