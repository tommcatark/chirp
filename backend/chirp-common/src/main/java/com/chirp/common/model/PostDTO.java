package com.chirp.common.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 帖子相关 DTO（Data Transfer Object）。
 * <p>
 * - CreatePostRequest：发帖请求，仅含正文；发帖人身份由 Authorization 头中的 JWT 解析，
 *   不再接受请求体里的 userId，防止冒充他人发帖
 * - PostResponse：时间线响应，附带作者昵称与 handle（邮箱前缀），供前端直接渲染
 * </p>
 */
public final class PostDTO {

    /** 发帖请求（身份来自 JWT，而非请求体） */
    public record CreatePostRequest(
            @NotBlank(message = "内容不能为空") @Size(max = 500, message = "内容不能超过 500 字符") String content
    ) {}

    /** 帖子响应（含作者信息） */
    public record PostResponse(
            Long id,
            Long userId,
            String authorName,
            String authorHandle,
            String content,
            Instant createdAt,
            long likes,
            long reposts,
            long comments
    ) {}

    private PostDTO() {}
}
