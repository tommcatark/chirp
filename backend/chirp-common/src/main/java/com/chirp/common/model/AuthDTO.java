package com.chirp.common.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 认证相关 DTO（Data Transfer Object）。
 * <p>
 * 将请求/响应 record 集中在公共模块，方便跨服务（如 Gateway 校验、Feign 调用）复用。
 * password 字段承载的是前端 RSA-OAEP 密文（Base64），实际长度由解密后的明文再校验。
 * </p>
 */
public final class AuthDTO {

    /** 注册请求 */
    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 120) String name,
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    /** 登录请求 */
    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    /** 忘记密码请求 */
    public record ForgotPasswordRequest(
            @NotBlank @Email String email
    ) {}

    /** 认证成功响应（注册 / 登录共用） */
    public record AuthResponse(Long id, String name, String email, String message) {}

    /** 错误响应 */
    public record ErrorResponse(String message) {}

    /** 通用消息响应 */
    public record MessageResponse(String message) {}

    private AuthDTO() {}
}