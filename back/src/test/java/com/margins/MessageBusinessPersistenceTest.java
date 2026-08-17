package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.margins.testsupport.TestSecurityContextSupport;

import com.margins.message.business.MessageBusiness;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.message.dto.UpdateMessageRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.message.mapper.MessageMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.message.model.MessageRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.session.dto.SessionMessageDto;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.http.HttpStatus;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.web.server.ResponseStatusException;
import com.margins.testsupport.TestSecurityContextSupport;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class MessageBusinessPersistenceTest {

    @Test
    void updateEditsUserMessageContent() {
        FakeMessageMapper mapper = new FakeMessageMapper();
        MessageBusiness business = new MessageBusiness(mapper);

        SessionMessageDto response = business.update(99L, UpdateMessageRequest.builder()
            .content("Edited reflection")
            .build());

        assertThat(mapper.updatedMessageId).isEqualTo(99L);
        assertThat(mapper.updatedUserId).isEqualTo(1L);
        assertThat(mapper.invalidatedWindowId).isEqualTo(88L);
        assertThat(mapper.invalidatedFromMessageId).isEqualTo(99L);
        assertThat(response.getContent()).isEqualTo("Edited reflection");
        assertThat(response.getMessageId()).isEqualTo(99L);
        assertThat(response.getMessageOrder()).isEqualTo(1);
    }

    @Test
    void deleteSoftDeletesUserMessage() {
        FakeMessageMapper mapper = new FakeMessageMapper();
        MessageBusiness business = new MessageBusiness(mapper);

        SessionMessageDto response = business.delete(99L);

        assertThat(mapper.deletedMessageId).isEqualTo(99L);
        assertThat(mapper.deletedUserId).isEqualTo(1L);
        assertThat(mapper.invalidatedWindowId).isEqualTo(88L);
        assertThat(mapper.invalidatedFromMessageId).isEqualTo(99L);
        assertThat(response.getContent()).isEqualTo("Original reflection");
    }

    @Test
    void updateMissingMessageReturnsNotFoundDomainError() {
        FakeMessageMapper mapper = new FakeMessageMapper();
        mapper.editable = false;
        MessageBusiness business = new MessageBusiness(mapper);

        assertThatThrownBy(() -> business.update(99L, UpdateMessageRequest.builder()
                .content("Edited reflection")
                .build()))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> assertThat(((ResponseStatusException) exception).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void deleteMissingMessageReturnsNotFoundDomainError() {
        FakeMessageMapper mapper = new FakeMessageMapper();
        mapper.editable = false;
        MessageBusiness business = new MessageBusiness(mapper);

        assertThatThrownBy(() -> business.delete(99L))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> assertThat(((ResponseStatusException) exception).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void deleteReturnsNotFoundWhenSoftDeleteUpdatesNoRows() {
        FakeMessageMapper mapper = new FakeMessageMapper();
        mapper.deletedRows = 0;
        MessageBusiness business = new MessageBusiness(mapper);

        assertThatThrownBy(() -> business.delete(99L))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies((exception) -> assertThat(((ResponseStatusException) exception).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(mapper.deletedMessageId).isEqualTo(99L);
    }

    private static class FakeMessageMapper implements MessageMapper {
        private Long updatedMessageId;
        private Long updatedUserId;
        private String content = "Original reflection";
        private Long deletedMessageId;
        private Long deletedUserId;
        private Long invalidatedWindowId;
        private Long invalidatedFromMessageId;
        private boolean editable = true;
        private int deletedRows = 1;

        @Override
        public int insert(MessageRecord record) {
            return 1;
        }

        @Override
        public int selectNextOrder(Long sessionId, Long windowId) {
            return 1;
        }

        @Override
        public List<MessageRecord> findBySessionId(Long sessionId) {
            return List.of();
        }

        @Override
        public List<MessageRecord> findRecentByWindowBefore(Long windowId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public List<MessageRecord> findSummaryCandidates(Long windowId, Long afterMessageId, Long beforeMessageId, int limit) {
            return List.of();
        }

        @Override
        public MessageRecord findEditableById(Long messageId, Long userId) {
            if (!editable) {
                return null;
            }
            return MessageRecord.builder()
                .id(messageId)
                .sessionId(77L)
                .windowId(88L)
                .userId(userId)
                .role("user")
                .content(content)
                .messageOrder(1)
                .questionId(42L)
                .streamingStatus("complete")
                .build();
        }

        @Override
        public int updateContent(Long messageId, Long userId, String content) {
            this.updatedMessageId = messageId;
            this.updatedUserId = userId;
            this.content = content;
            return 1;
        }

        @Override
        public int invalidateConversationSummary(Long windowId, Long messageId) {
            this.invalidatedWindowId = windowId;
            this.invalidatedFromMessageId = messageId;
            return 1;
        }

        @Override
        public int softDelete(Long messageId, Long userId) {
            this.deletedMessageId = messageId;
            this.deletedUserId = userId;
            return deletedRows;
        }
    }
}
