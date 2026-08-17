package com.margins.testsupport;

import com.margins.auth.model.UserRecord;
import java.time.Instant;

public final class TestAuthSupport {

  public static final String TEST_USERNAME = "demo_reader";
  public static final String TEST_PASSWORD = "reader";
  public static final String TEST_PASSWORD_HASH =
      "$2b$12$x0GhNoH36hSY1OcS4EdDd.Nc8sm8B3mvPfBPr6aOFspYF2nqYtAhy";

  private TestAuthSupport() {
  }

  public static UserRecord demo_readerUser() {
    return UserRecord.builder()
        .id(1L)
        .username(TEST_USERNAME)
        .displayName(TEST_USERNAME)
        .email("demo_reader@test.margins.local")
        .emailVerified(true)
        .passwordHash(TEST_PASSWORD_HASH)
        .authProvider("local")
        .accountStatus("ACTIVE")
        .credentialsVersion(1L)
        .failedLoginCount(0)
        .lockedUntil(null)
        .lastLoginAt(Instant.now())
        .testData(true)
        .build();
  }
}
