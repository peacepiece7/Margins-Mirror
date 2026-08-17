package com.margins.moderation;

public record DiscussionModerationRequest(
    String requestId,
    Long windowId,
    String content
) {
}
