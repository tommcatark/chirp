package com.chirp.common.model;

import java.time.Instant;

/**
 * 私信相关 DTO。
 */
public final class MessageDTO {

    public record MessageResponse(
            Long id,
            Long senderId,
            Long recipientId,
            String content,
            boolean isRead,
            Instant createdAt
    ) {}

    public record ConversationUser(
            Long id,
            String name,
            String handle,
            String avatarUrl
    ) {}

    public record ConversationResponse(
            ConversationUser user,
            MessageResponse lastMessage,
            long unreadCount
    ) {}

    public record SendRequest(
            Long recipientId,
            String content
    ) {}

    public record MarkReadRequest(
            Long with
    ) {}

    private MessageDTO() {}
}
