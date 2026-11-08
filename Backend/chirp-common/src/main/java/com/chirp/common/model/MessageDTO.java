package com.chirp.common.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;

/**
 * 私信相关 DTO。
 * <p>
 * 规范 §1.5：布尔字段 isRead 保留 is 前缀，前端按此读取。
 * 规范 §4.1：会话列表响应 {items, totalUnread}。
 * 规范 §4.2：消息列表响应 PageResponse<MessageResponse>。
 * </p>
 */
public final class MessageDTO {

    public record MessageResponse(
            Long id,
            Long senderId,
            Long recipientId,
            String content,
            @JsonProperty("isRead") boolean isRead,
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

    public record ConversationsResponse(
            List<ConversationResponse> items,
            long totalUnread
    ) {}

    public record SendRequest(
            Long recipientId,
            String content
    ) {}

    public record MarkReadRequest(
            Long with
    ) {}

    public record UnreadCountResponse(
            long unreadCount
    ) {}

    private MessageDTO() {}
}