package com.margins.moderation.service;

import com.margins.moderation.business.ModerationBusiness;
import com.margins.moderation.dto.ModerationEventDto;
import com.margins.moderation.dto.ModerationFeedbackRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
/** moderation 변경을 transaction 경계 안에서 business 계층에 위임한다. */
public class ModerationService {
    private final ModerationBusiness moderationBusiness;

    @Transactional
    public ModerationEventDto feedback(Long eventId, ModerationFeedbackRequest request) {
        return moderationBusiness.feedback(eventId, request);
    }
}
