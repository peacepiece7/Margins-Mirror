package com.margins.reflectionloop.model.dto.response;

public sealed interface DiscussionGuideProjectionResponse permits
    FacilitatorDiscussionGuideProjectionResponse,
    ParticipantDiscussionGuideProjectionResponse {
}
