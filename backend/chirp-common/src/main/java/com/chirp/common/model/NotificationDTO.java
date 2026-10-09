package com.chirp.common.model;

import java.time.Instant;
import java.util.List;

/**
 * 通知相关 DTO。
 * <p>
 * 规范 §3.0 NotificationResponse：
 * - type 枚举：like / comment / follow
 * - actor：触发者 {id, name, handle, avatarUrl}
 * - postExcerpt：帖子正文摘要（截取前 50 字符），帖子已删除或 type=follow 时为 null
 * - commentExcerpt：评论摘要（前 50 字符），仅 type=comment 有值
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
            boolean isRead,
            Instant createdAt
    ) {}

    public record MarkReadRequest(
            List<Long> ids
    ) {}

    private NotificationDTO() {}
}