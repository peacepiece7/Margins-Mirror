package com.margins.session.service;

import com.margins.question.dto.CreateQuestionRequest;
import com.margins.question.dto.GenerateQuestionsRequest;
import com.margins.question.dto.QuestionDto;
import com.margins.question.dto.QuestionListResponse;
import com.margins.session.business.SessionWindowBusiness;
import com.margins.session.dto.AiMessageResponse;
import com.margins.session.dto.CreateSessionWindowRequest;
import com.margins.session.dto.CreateSessionWindowResponse;
import com.margins.session.dto.DebateAllMessageRequest;
import com.margins.session.dto.DebateMessageRequest;
import com.margins.session.dto.DebateTurnResponse;
import com.margins.session.dto.SendMessageRequest;
import com.margins.session.dto.UpdateSessionWindowTitleRequest;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 세션 윈도우 비즈니스 로직 사이의 서비스 계층이다.
 * 윈도우 생성/수정과 AI 대화 요청을 업무 규칙으로 위임한다.
 */
@Service
@RequiredArgsConstructor
public class SessionWindowService {

    private final SessionWindowBusiness sessionWindowBusiness;

    @Transactional
    public CreateSessionWindowResponse create(CreateSessionWindowRequest request) {
        return sessionWindowBusiness.create(request);
    }

    @Transactional
    public CreateSessionWindowResponse updateTitle(Long windowId, UpdateSessionWindowTitleRequest request) {
        return sessionWindowBusiness.updateTitle(windowId, request);
    }

    @Transactional
    public CreateSessionWindowResponse archive(Long windowId) {
        return sessionWindowBusiness.archive(windowId);
    }

    @Transactional
    public AiMessageResponse sendMessage(Long windowId, SendMessageRequest request) {
        return sessionWindowBusiness.sendMessage(windowId, request);
    }

    @Transactional
    public AiMessageResponse streamMessage(Long windowId, SendMessageRequest request, Consumer<String> deltaConsumer) {
        return sessionWindowBusiness.streamMessage(windowId, request, deltaConsumer);
    }

    @Transactional(readOnly = true)
    public QuestionListResponse questions(Long windowId) {
        return sessionWindowBusiness.questions(windowId);
    }

    @Transactional
    public QuestionListResponse createQuestion(Long windowId, CreateQuestionRequest request) {
        return sessionWindowBusiness.createQuestion(windowId, request);
    }

    @Transactional
    public QuestionListResponse generateQuestions(Long windowId, GenerateQuestionsRequest request) {
        return sessionWindowBusiness.generateQuestions(windowId, request);
    }

    @Transactional
    public QuestionDto deleteQuestion(Long questionId) {
        return sessionWindowBusiness.deleteQuestion(questionId);
    }

    @Transactional
    public CreateSessionWindowResponse ensureQuestionDebateWindow(Long questionId) {
        return sessionWindowBusiness.ensureQuestionDebateWindow(questionId);
    }

    @Transactional
    public DebateTurnResponse debate(Long windowId, DebateMessageRequest request) {
        return sessionWindowBusiness.debate(windowId, request);
    }

    @Transactional
    public DebateTurnResponse debateAll(Long windowId, DebateAllMessageRequest request) {
        return sessionWindowBusiness.debateAll(windowId, request);
    }
}
