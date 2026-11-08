package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 会话令牌实体 — 存储用户登录后的认证 token。
 * <p>
 * 关键字段：
 * - token: 64 位随机 token，全局唯一（uk_tokens_token）
 * - expiresAt: token 过期时间，默认创建后 7 天
 * - userId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除令牌）
 * </p>
 */
@Entity
@Table(name = "tokens", uniqueConstraints = @UniqueConstraint(name = "uk_tokens_token", columnNames = "token"))
public class Token {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 令牌所属用户，外键关联 users.id，删除用户时级联删除令牌 */
    @Column(nullable = false)
    private Long userId;

    /** 64 位随机 token，用于无状态会话校验 */
    @Column(nullable = false, length = 64)
    private String token;

    /** token 过期时间，默认为创建时间 +7 天 */
    @Column(nullable = false)
    private Instant expiresAt;

    /** 创建时间 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Token() {}

    /** 业务构造器：创建 token 时使用，createdAt 自动填充 */
    public Token(Long userId, String token, Instant expiresAt) {
        this.userId = userId;
        this.token = token;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getToken() { return token; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getCreatedAt() { return createdAt; }
}