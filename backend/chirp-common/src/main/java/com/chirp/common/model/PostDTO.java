package com.chirp.common.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 帖子相关 DTO（Data Transfer Object）。
 * <p>
 * - CreatePostRequest：发帖请求，userId 标识发帖人，content 为正文（1-500 字符）
 * - PostResponse：时间线响应，附带作者昵称与 handle（邮箱前缀），供前端直接渲染
 * </p>
 * 说明：当前系统尚未下发会话令牌，userId 由前端登录态提供并在服务端校验存在性；
 * 后续接入 Token 鉴权后，改为从令牌解析用户，不再信任请求体中的 userId。
 */
public final class PostDTO {

    /** 发帖请求 */
    public record CreatePostRequest(
            @NotNull(message = "缺少用户信息，请重新登录") Long userId,
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
