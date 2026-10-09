package com.chirp.common.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 帖子相关 DTO。
 * <p>
 * 规范 §3.0 PostResponse：
 * - 含作者信息（authorName, authorHandle, authorAvatarUrl）
 * - liked：当前请求者是否已点赞，未登录时恒为 false
 * - mine：是否为当前请求者发布，未登录时恒为 false
 * - 作者被删除时 authorName="未知用户", authorHandle="unknown"
 * </p>
 */
public final class PostDTO {

    /** 发帖请求 — 规范 §3.2.2：身份来自 token，请求体仅含 content */
    public record CreatePostRequest(
            @NotBlank(message = "内容不能为空") @Size(max = 500, message = "内容不能超过 500 字符") String content
    ) {}

    /** 帖子响应 — 规范 §3.0 PostResponse */
    public record PostResponse(
            Long id,
            Long userId,
            String authorName,
            String authorHandle,
            String authorAvatarUrl,
            String content,
            Instant createdAt,
            long likes,
            long reposts,
            long comments,
            boolean liked,
            boolean mine
    ) {}

    /** 点赞/取消点赞响应 — 规范 §3.2.6 / §3.2.7 */
    public record LikeResponse(boolean liked, long likes) {}

    private PostDTO() {}
}