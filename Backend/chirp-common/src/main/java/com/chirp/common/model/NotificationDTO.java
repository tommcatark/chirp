package com.chirp.common.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;

/**
 * 通知相关 DTO。
 * <p>
 * 规范 §1.5：布尔字段 isRead 保留 is 前缀，前端按此读取。
 * 规范 §3.1：通知列表响应 PageResponse + unreadCount。
 * </p>
 */
public final class NotificationDTO {

    public record NotificationActor(
            Long id,
            String name,
            String handle,
            String avatarUrl
    ) {}

    public record NotificationResponse(
            Long id,
            String type,
            NotificationActor actor,
            Long postId,
            String postExcerpt,
            Long commentId,
            String commentExcerpt,
            @JsonProperty("isRead") boolean isRead,
            Instant createdAt
    ) {}

    public record NotificationPageResponse(
            List<NotificationResponse> items,
            long total,
            int offset,
            int limit,
            boolean hasMore,
            long unreadCount
    ) {}

    public record MarkReadRequest(
            List<Long> ids
    ) {}

    public record MarkReadResponse(
            long unreadCount
    ) {}

    private NotificationDTO() {}
}