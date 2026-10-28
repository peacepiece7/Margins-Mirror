package com.margins;

import static org.assertj.core.api.Assertions.*;
import com.margins.ai.GenerationLocale;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.dto.UpdateBookBackgroundRequest;
import com.margins.book.mapper.BookMapper;
import com.margins.book.service.BookBackgroundService;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.reflectionloop.business.ReflectionEvidenceCatalog;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.session.mapper.SessionWindowMapper;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class BookBackgroundIntegrationTest extends AbstractMySqlIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired BookBackgroundService background;
    @Autowired BookMapper books;
    @Autowired BookKnowledgeBusiness knowledge;
    @Autowired SessionWindowMapper windows;
    @Autowired ReflectionEvidenceCatalog evidence;
    @Autowired com.margins.testsupport.business.JdbcTestDataResetExecutor reset;

    @BeforeEach void setUp() {
        clean();
        jdbc.update("INSERT INTO users(id,username,display_name,password_hash,auth_provider,is_test_data) VALUES(971,'background-owner','Reader','fixture','local',TRUE),(972,'background-other','Other','fixture','local',TRUE)");
        jdbc.update("INSERT INTO books(id,user_id,title,author,isbn,is_test_data) VALUES(971,971,'Background fixture','Margins','9780000000061',TRUE),(972,972,'Background fixture','Margins','9780000000061',TRUE)");
        jdbc.update("INSERT INTO reading_sessions(id,user_id,book_id,title,is_test_data) VALUES(971,971,971,'Background fixture',TRUE)");
        jdbc.update("INSERT INTO session_windows(id,user_id,session_id,window_type,title,is_test_data) VALUES(971,971,971,'debate','Background fixture',TRUE)");
        TestSecurityContextSupport.loginAs(971L, "background-owner");
    }

    @AfterEach void tearDown() { TestSecurityContextSupport.clear(); clean(); }
    private void clean() {
        jdbc.update("DELETE FROM session_windows WHERE id=971");
        jdbc.update("DELETE FROM reading_sessions WHERE id=971");
        jdbc.update("DELETE FROM books WHERE id IN (971,972)");
        jdbc.update("DELETE FROM users WHERE id IN (971,972)");
        jdbc.update("DELETE FROM book_knowledge WHERE lookup_key='9780000000061'");
    }
    private UpdateBookBackgroundRequest request(String summary, int revision) {
        return UpdateBookBackgroundRequest.builder().summary(summary).expectedRevision(revision).build();
    }

    @Test void defaultsCasRestoreAndOwnerBoundaryArePersisted() {
        assertThat(background.find(971L).getRevision()).isZero();
        assertThat(background.find(971L).getSummary()).isNull();
        assertThat(background.find(971L).getUpdatedAt()).isNull();
        assertThat(background.update(971L, request("  Reader text  ", 0)).getRevision()).isEqualTo(1);
        assertThat(background.find(971L).getSummary()).isEqualTo("Reader text");
        assertThat(background.find(971L).getUpdatedAt()).isNotNull();
        assertThatThrownBy(() -> background.update(971L, request("Lost update", 0)))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo(ApiErrorCode.COMMON_CONFLICT);
        assertThatThrownBy(() -> background.update(972L, request("Foreign", 0)))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo(ApiErrorCode.COMMON_NOT_FOUND);
        assertThat(books.findByIdForUser(972L, 972L).getBackgroundSummary()).isNull();
        assertThat(background.update(971L, request(null, 1)).getRevision()).isEqualTo(2);
        assertThat(background.find(971L).getSummary()).isNull();
        jdbc.update("UPDATE books SET deleted_at=CURRENT_TIMESTAMP WHERE id=971");
        assertThatThrownBy(() -> background.find(971L)).isInstanceOf(ApiException.class)
            .extracting("code").isEqualTo(ApiErrorCode.COMMON_NOT_FOUND);
    }

    @Test void regenerationLocaleAndContextDoNotOverwritePrivateText() {
        knowledge.ensureForBook(971L, 971L);
        String original = knowledge.findForBook(971L).getSummary();
        background.update(971L, request("Reader-authored facts", 0));
        assertThat(knowledge.findForBook(971L).getSummary()).isEqualTo(original);
        var refresh = knowledge.requestRegeneration(971L);
        if (refresh.work() != null) knowledge.completeRegeneration(refresh.work());
        jdbc.update("UPDATE users SET preferred_locale='ko' WHERE id=971");
        assertThat(background.find(971L).getSummary()).isEqualTo("Reader-authored facts");
        var context = windows.findContextById(971L);
        assertThat(context.getBookBackgroundSummary()).isEqualTo("Reader-authored facts");
        assertThat(context.getBookBackgroundRevision()).isEqualTo(1);
        var catalog = evidence.load(ReflectionInterviewRecord.builder().id(971L).sessionId(971L).build(),
            ReflectionRevisionRecord.builder().id(971L).content("Reflection").build(), false, GenerationLocale.KO);
        assertThat(catalog.firstBookKnowledge().excerpt()).isEqualTo("Reader-authored facts");
        assertThat(catalog.firstBookKnowledge().version()).isEqualTo("reader-background-v1");
    }

    @Test void testResetRemovesTestBackgroundButPreservesNonTestBackgroundAndSharedKnowledge() {
        background.update(971L, request("Test-owned background", 0));
        jdbc.update("UPDATE users SET is_test_data=FALSE WHERE id=972");
        jdbc.update("UPDATE books SET is_test_data=FALSE,background_summary='Non-test fixture background',background_revision=7 WHERE id=972");
        TestSecurityContextSupport.loginAs(972L, "background-other");
        knowledge.ensureForBook(972L, 972L);
        String original = knowledge.findForBook(972L).getSummary();
        reset.resetTestData();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM books WHERE id=971", Integer.class)).isZero();
        assertThat(background.find(972L).getSummary()).isEqualTo("Non-test fixture background");
        assertThat(background.find(972L).getRevision()).isEqualTo(7);
        assertThat(knowledge.findForBook(972L).getSummary()).isEqualTo(original);
    }
}
