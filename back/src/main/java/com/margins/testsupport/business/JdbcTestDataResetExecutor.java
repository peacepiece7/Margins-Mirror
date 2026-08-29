package com.margins.testsupport.business;

import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

/**
 * 테스트 데이터 초기화를 실제 JDBC로 수행하는 실행기다.
 * E2E와 통합 테스트가 남긴 레코드를 안전한 순서로 정리한다.
 */
@Component
@RequiredArgsConstructor
public class JdbcTestDataResetExecutor implements TestDataResetExecutor {

    private final DataSource dataSource;

    @Value("${margins.test-support.seed-script:../db/seed/001_seed_mvp_data.sql}")
    private String seedScriptPath;

    @Value("${margins.test-support.auth-seed-script:../db/seed/002_auth_test_credentials.sql}")
    private String authSeedScriptPath;

    @Override
    public void resetTestData() {
        Connection connection = DataSourceUtils.getConnection(dataSource);
        try {
            deleteTestData(connection);
            ScriptUtils.executeSqlScript(
                connection,
                new EncodedResource(new FileSystemResource(seedScriptPath), "UTF-8")
            );
            ScriptUtils.executeSqlScript(
                connection,
                new EncodedResource(new FileSystemResource(authSeedScriptPath), "UTF-8")
            );
        } finally {
            DataSourceUtils.releaseConnection(connection, dataSource);
        }
    }

    private void deleteTestData(Connection connection) {
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET FOREIGN_KEY_CHECKS = 0");
            try {
                statement.executeUpdate("DELETE FROM contact_inquiries WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM ai_generation_events WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM moderation_events WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM moderation_daily_aggregates WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM metrics WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM memory_cards WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM memory_card_groups WHERE is_test_data = TRUE");
                statement.executeUpdate(
                    "DELETE FROM discussion_run_refinements WHERE run_id IN (SELECT id FROM discussion_runs WHERE is_test_data = TRUE)");
                statement.executeUpdate(
                    "DELETE FROM reflection_summaries WHERE reflection_insight_id IN (SELECT id FROM session_insights WHERE is_test_data = TRUE)");
                statement.executeUpdate("DELETE FROM discussion_runs WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM discussion_guide_items WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM discussion_guides WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM messages WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM session_window_personas WHERE window_id IN (SELECT id FROM session_windows WHERE is_test_data = TRUE)");
                statement.executeUpdate("DELETE FROM review_comments WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM session_tags WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM session_highlights WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM reflection_interview_answer_revisions WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM questions WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM reflection_interviews WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM reflection_revisions WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM session_insights WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM personas WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM session_windows WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM reading_sessions WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM book_candidates WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM books WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM refresh_tokens");
                statement.executeUpdate("DELETE FROM user_oauth_identities");
                statement.executeUpdate(
                    "DELETE FROM auth_email_verification_rate_limits WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM auth_email_verifications WHERE is_test_data = TRUE");
                statement.executeUpdate("DELETE FROM users WHERE is_test_data = TRUE");
            } finally {
                statement.execute("SET FOREIGN_KEY_CHECKS = 1");
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to delete test data", exception);
        }
    }
}
