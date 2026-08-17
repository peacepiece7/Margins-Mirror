package com.margins.testsupport;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import javax.sql.DataSource;

public final class IntegrationSchemaSupport {

    private static final Path SCHEMA_DIR = Path.of("../db/schema");
    private static final String CREATE_SCHEMA_MIGRATIONS_SQL = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id BIGINT NOT NULL AUTO_INCREMENT,
          version VARCHAR(40) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          checksum_sha256 CHAR(64) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_schema_migrations_version (version),
          UNIQUE KEY uk_schema_migrations_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """;
    private static volatile boolean schemaApplied;

    private IntegrationSchemaSupport() {
    }

    public static void ensureSchema(DataSource dataSource) throws IOException, SQLException {
        if (schemaApplied) {
            return;
        }
        synchronized (IntegrationSchemaSupport.class) {
            if (schemaApplied) {
                return;
            }
            execute(dataSource, CREATE_SCHEMA_MIGRATIONS_SQL);
            applySqlFiles(dataSource, listSchemaFiles());
            schemaApplied = true;
        }
    }

    public static void resetPersonas(DataSource dataSource) throws SQLException {
        execute(dataSource, "SET FOREIGN_KEY_CHECKS = 0");
        execute(dataSource, "TRUNCATE TABLE personas");
        execute(dataSource, "SET FOREIGN_KEY_CHECKS = 1");
    }

    public static void resetBooksAndUsers(DataSource dataSource) throws SQLException {
        execute(dataSource, "SET FOREIGN_KEY_CHECKS = 0");
        execute(dataSource, "TRUNCATE TABLE books");
        execute(dataSource, "TRUNCATE TABLE users");
        execute(dataSource, "SET FOREIGN_KEY_CHECKS = 1");
        seedIntegrationUser(dataSource);
    }

    public static void seedIntegrationUser(DataSource dataSource) throws SQLException {
        executeSql(
            dataSource,
            "DELETE FROM user_consent_events WHERE user_id = 1 AND is_test_data = TRUE",
            """
            INSERT INTO users (id, username, display_name, email, email_verified, password_hash, auth_provider, is_test_data)
            VALUES (
              1,
              'demo_reader',
              'demo_reader',
              'demo_reader@test.margins.local',
              TRUE,
              '$2b$12$x0GhNoH36hSY1OcS4EdDd.Nc8sm8B3mvPfBPr6aOFspYF2nqYtAhy',
              'local',
              TRUE
            )
            """,
            """
            INSERT INTO user_consent_events
              (user_id, consent_type, document_version, event_type, registration_channel, is_test_data)
            VALUES
              (1, 'PRIVACY_POLICY', '2026-07-27', 'GRANTED', 'SEED', TRUE),
              (1, 'OPENAI_OVERSEAS_TRANSFER', '2026-07-27', 'GRANTED', 'SEED', TRUE),
              (1, 'AGE_OVER_14', '2026-07-27', 'GRANTED', 'SEED', TRUE)
            """
        );
    }

    public static void executeSql(DataSource dataSource, String... statements) throws SQLException {
        for (String statement : statements) {
            execute(dataSource, statement);
        }
    }

    private static List<Path> listSchemaFiles() throws IOException {
        try (Stream<Path> paths = Files.list(SCHEMA_DIR)) {
            return paths
                .filter(path -> path.getFileName().toString().endsWith(".sql"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .toList();
        }
    }

    private static void applySqlFiles(DataSource dataSource, List<Path> files) throws IOException, SQLException {
        try (Connection connection = dataSource.getConnection()) {
            for (Path file : files) {
                String sql = Files.readString(file);
                runScript(connection, sql);
            }
        }
    }

    private static void runScript(Connection connection, String sql) throws SQLException {
        String trimmed = sql.trim();
        if (trimmed.isEmpty()) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute(trimmed);
        }
    }

    private static void execute(DataSource dataSource, String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
            Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
