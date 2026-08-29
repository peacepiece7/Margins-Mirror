package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.mockito.Mockito.inOrder;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.mockito.Mockito.mock;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.mockito.Mockito.when;
import com.margins.testsupport.TestSecurityContextSupport;

import com.margins.testsupport.business.JdbcTestDataResetExecutor;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.testsupport.business.TestResetBusiness;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.testsupport.business.TestDataResetExecutor;
import com.margins.testsupport.TestSecurityContextSupport;
import java.sql.Connection;
import com.margins.testsupport.TestSecurityContextSupport;
import java.sql.SQLException;
import com.margins.testsupport.TestSecurityContextSupport;
import java.sql.Statement;
import com.margins.testsupport.TestSecurityContextSupport;
import javax.sql.DataSource;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.margins.testsupport.TestSecurityContextSupport;
import org.mockito.InOrder;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import com.margins.testsupport.TestSecurityContextSupport;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class TestResetBusinessTest {

    @Test
    void resetAllowedInTestProfile() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        FakeResetExecutor executor = new FakeResetExecutor();

        TestResetBusiness business = new TestResetBusiness(environment, executor);

        assertThat(business.reset().isReset()).isTrue();
        assertThat(business.reset().getMode()).isEqualTo("jdbc-seed-reset");
        assertThat(executor.calls).isEqualTo(2);
    }

    @Test
    void resetRejectedOutsideLocalOrTestProfile() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        FakeResetExecutor executor = new FakeResetExecutor();

        TestResetBusiness business = new TestResetBusiness(environment, executor);

        assertThatThrownBy(business::reset)
            .isInstanceOf(ResponseStatusException.class);
        assertThat(executor.calls).isZero();
    }

    @Test
    void jdbcResetReenablesForeignKeyChecksWhenDeleteFails() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeUpdate("DELETE FROM messages WHERE is_test_data = TRUE"))
            .thenThrow(new SQLException("delete failed"));
        JdbcTestDataResetExecutor executor = new JdbcTestDataResetExecutor(dataSource);

        assertThatThrownBy(executor::resetTestData)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Failed to delete test data");

        InOrder order = inOrder(statement);
        order.verify(statement).execute("SET FOREIGN_KEY_CHECKS = 0");
        order.verify(statement).executeUpdate(
            "DELETE FROM ai_generation_events WHERE is_test_data = TRUE");
        order.verify(statement).executeUpdate("DELETE FROM metrics WHERE is_test_data = TRUE");
        order.verify(statement).executeUpdate("DELETE FROM messages WHERE is_test_data = TRUE");
        order.verify(statement).execute("SET FOREIGN_KEY_CHECKS = 1");
    }

    @Test
    void jdbcResetDeletesWindowPersonasBeforeParentRows() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);

        JdbcTestDataResetExecutor executor = new JdbcTestDataResetExecutor(dataSource);
        ReflectionTestUtils.invokeMethod(executor, "deleteTestData", connection);

        InOrder order = inOrder(statement);
        order.verify(statement).execute("SET FOREIGN_KEY_CHECKS = 0");
        order.verify(statement).executeUpdate(
            "DELETE FROM discussion_run_refinements WHERE run_id IN (SELECT id FROM discussion_runs WHERE is_test_data = TRUE)");
        order.verify(statement).executeUpdate(
            "DELETE FROM reflection_summaries WHERE reflection_insight_id IN (SELECT id FROM session_insights WHERE is_test_data = TRUE)");
        order.verify(statement).executeUpdate("DELETE FROM discussion_runs WHERE is_test_data = TRUE");
        order.verify(statement).executeUpdate("DELETE FROM messages WHERE is_test_data = TRUE");
        order.verify(statement).executeUpdate(
            "DELETE FROM session_window_personas WHERE window_id IN (SELECT id FROM session_windows WHERE is_test_data = TRUE)");
        order.verify(statement).executeUpdate("DELETE FROM session_insights WHERE is_test_data = TRUE");
        order.verify(statement).executeUpdate("DELETE FROM personas WHERE is_test_data = TRUE");
        order.verify(statement).executeUpdate("DELETE FROM session_windows WHERE is_test_data = TRUE");
        order.verify(statement).execute("SET FOREIGN_KEY_CHECKS = 1");
    }

    private static class FakeResetExecutor implements TestDataResetExecutor {
        private int calls;

        @Override
        public void resetTestData() {
            calls++;
        }
    }
}
