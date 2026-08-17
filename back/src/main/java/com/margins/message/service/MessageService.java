package com.margins.message.service;

import com.margins.message.business.MessageBusiness;
import com.margins.message.dto.UpdateMessageRequest;
import com.margins.session.dto.SessionMessageDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 메시지 비즈니스 로직 사이의 서비스 계층이다.
 * 대화 요청을 검증된 업무 흐름으로 위임하고 DTO 응답을 반환한다.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageBusiness messageBusiness;

    @Transactional
    public SessionMessageDto update(Long messageId, UpdateMessageRequest request) {
        return messageBusiness.update(messageId, request);
    }

    @Transactional
    public SessionMessageDto delete(Long messageId) {
        return messageBusiness.delete(messageId);
    }
}
