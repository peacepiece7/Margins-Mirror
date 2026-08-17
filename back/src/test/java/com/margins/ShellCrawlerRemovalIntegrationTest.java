package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.testsupport.AbstractMySqlIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ShellCrawlerRemovalIntegrationTest extends AbstractMySqlIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void appendOnlySchemaMigrationRemovesRetiredSaveTable() {
        Integer tableCount = jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = 'shell_crawler_saves'
            """,
            Integer.class
        );

        assertThat(tableCount).isZero();
    }
}
