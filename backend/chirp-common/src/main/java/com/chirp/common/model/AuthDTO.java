package com.chirp.common.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 认证相关 DTO（Data Transfer Object）。
 * <p>
 * 规范 §3.1.2 / §3.1.3：
 * - AuthResponse 统一包含 token / expiresAt / id / name / email / handle / avatarUrl / message
 * - 注册成功即登录态，前端不再二次登录
 * - token 为 64 位随机字符串（规范 D1：DB token，不用 JWT）
 * </p>
 */
public final class AuthDTO {

    public record RegisterRequest(
            @NotBlank(message = "昵称需要 2-120 个字符") @Size(min = 2, max = 120, message = "昵称需要 2-120 个字符") String name,
            @NotBlank(message = "请输入有效的邮箱地址") @Email(message = "请输入有效的邮箱地址") String email,
            @NotBlank String password
    ) {}

    public record LoginRequest(
            @NotBlank(message = "请输入有效的邮箱地址") @Email(message = "请输入有效的邮箱地址") String email,
            @NotBlank String password
    ) {}

    public record ForgotPasswordRequest(
            @NotBlank @Email String email
    ) {}

    /**
     * 认证成功响应（注册 / 登录共用）。
     * <p>
     * 规范 §3.1.3 AuthResponse：
     * - token：64 位随机字符串，前端存 chirpToken
     * - expiresAt：token 过期时间，ISO-8601 UTC
     * - id / name / email / handle / avatarUrl：当前用户基础信息，前端存 chirpUser
     * </p>
     */
    public record AuthResponse(
            String token,
            Instant expiresAt,
            Long id,
            String name,
            String email,
            String handle,
            String avatarUrl,
            String message
    ) {}

    /** 错误响应 — 规范 §1.4：统一 { "message": "..." } */
    public record ErrorResponse(String message) {}

    /** 通用消息响应 */
    public record MessageResponse(String message) {}

    private AuthDTO() {}
}