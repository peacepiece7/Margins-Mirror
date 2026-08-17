package com.margins.message.business;

import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.message.dto.UpdateMessageRequest;
import com.margins.message.mapper.MessageMapper;
import com.margins.message.model.MessageRecord;
import com.margins.session.dto.SessionMessageDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 메시지 도메인의 핵심 업무 규칙을 처리한다.
 * 세션/윈도우 소유권을 확인하고 대화 메시지 조회, 작성, 수정, 삭제를 조율한다.
 */
@Component
@RequiredArgsConstructor
public class MessageBusiness {

    /** 저장된 메시지를 수정하기 전에 현재 사용자를 확인한다. */
    private long currentUserId() {
        return AuthContext.requireUserId();
    }

    private final MessageMapper messageMapper;

    /** 사용자가 수정할 수 있는 메시지만 수정하고 새로고침된 DTO를 반환한다. */
    public SessionMessageDto update(Long messageId, UpdateMessageRequest request) {
        MessageRecord record = requireEditableMessage(messageId);
        messageMapper.updateContent(messageId, currentUserId(), request.getContent());
        messageMapper.invalidateConversationSummary(record.getWindowId(), messageId);
        return toDto(requireEditableMessage(messageId));
    }

    /** 수정 가능한 메시지를 소프트 삭제하고 이전 형태를 클라이언트에 반환한다. */
    public SessionMessageDto delete(Long messageId) {
        MessageRecord record = requireEditableMessage(messageId);
        requireUpdated(messageMapper.softDelete(messageId, currentUserId()));
        messageMapper.invalidateConversationSummary(record.getWindowId(), messageId);
        return toDto(record);
    }

    /** 수정/삭제 작업 전에 소유권과 수정 가능 여부를 강제한다. */
    private MessageRecord requireEditableMessage(Long messageId) {
        MessageRecord record = messageMapper.findEditableById(messageId, currentUserId());
        if (record == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Editable message not found");
        }
        return record;
    }

    /** 실패한 매퍼 갱신을 누락 레코드와 같은 찾을 수 없음 응답으로 변환한다. */
    private void requireUpdated(int updatedRows) {
        if (updatedRows <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Editable message not found");
        }
    }

    /** 메시지 저장 필드를 timeline DTO로 매핑한다. */
    private SessionMessageDto toDto(MessageRecord record) {
        return SessionMessageDto.builder()
            .messageId(record.getId())
            .sessionId(record.getSessionId())
            .windowId(record.getWindowId())
            .parentMessageId(record.getParentMessageId())
            .role(record.getRole())
            .content(record.getContent())
            .messageOrder(record.getMessageOrder())
            .aiModel(record.getAiModel())
            .personaId(record.getPersonaId())
            .questionId(record.getQuestionId())
            .streamingStatus(record.getStreamingStatus())
            .build();
    }
}
