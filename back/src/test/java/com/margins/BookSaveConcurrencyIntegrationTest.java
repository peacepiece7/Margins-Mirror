package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.book.business.BookBusiness;
import com.margins.book.dto.SaveBookRequest;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.IntegrationFixtureSupport;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class BookSaveConcurrencyIntegrationTest extends AbstractMySqlIntegrationTest {

    @Autowired
    private BookBusiness bookBusiness;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void resetBooks() throws Exception {
        IntegrationFixtureSupport.resetSessionGraph(dataSource);
    }

    @Test
    // BDD: BOOK-019
    void concurrentSaveOfSameSourceReferenceCreatesOneActiveBook() throws Exception {
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> saveAfter(start));
            var second = executor.submit(() -> saveAfter(start));
            start.countDown();

            assertThat(java.util.List.of(first.get(), second.get()))
                .containsExactlyInAnyOrder("saved", ApiErrorCode.BOOK_ALREADY_EXISTS.name());
        }

        assertThat(jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM books
            WHERE user_id = 1
              AND source_ref = 'google:concurrent-book'
              AND deleted_at IS NULL
            """,
            Integer.class
        )).isEqualTo(1);
    }

    private String saveAfter(CountDownLatch start) throws Exception {
        TestSecurityContextSupport.loginAs(1L, "peacepiece");
        try {
            start.await();
            bookBusiness.saveBook(SaveBookRequest.builder()
                .candidateId("google:concurrent-book")
                .title("Concurrent Book Save")
                .author("Fixture Author")
                .readingStatus("reading")
                .build());
            return "saved";
        } catch (ApiException exception) {
            return exception.getCode().name();
        } finally {
            TestSecurityContextSupport.clear();
        }
    }
}
