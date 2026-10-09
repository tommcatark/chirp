package com.chirp.common.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 评论相关 DTO。
 * <p>
 * 规范 §3.0 CommentResponse：
 * - 含作者信息（authorName, authorHandle, authorAvatarUrl）
 * - mine：是否为当前请求者发布，未登录时恒为 false
 * </p>
 */
public final class CommentDTO {

    public record CreateCommentRequest(
            @NotBlank(message = "评论不能为空") @Size(max = 500, message = "评论不能超过 500 字符") String content
    ) {}

    public record CommentResponse(
            Long id,
            Long postId,
            Long userId,
            String authorName,
            String authorHandle,
            String authorAvatarUrl,
            String content,
            Instant createdAt,
            boolean mine
    ) {}

    private CommentDTO() {}
}